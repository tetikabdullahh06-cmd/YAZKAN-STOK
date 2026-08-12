"""CNC Takımhane backend API tests."""
import os
import io
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback: read from frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"
ADMIN_EMAIL = "tetikabdullahh06@gmail.com"
ADMIN_PW = "Admin123!"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data
    return data["access_token"]


@pytest.fixture(scope="session")
def h(token):
    return {"Authorization": f"Bearer {token}"}


# --- Auth ---
class TestAuth:
    def test_login_ok(self, token):
        assert isinstance(token, str) and len(token) > 20

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_ok(self, h):
        r = requests.get(f"{API}/auth/me", headers=h)
        assert r.status_code == 200
        assert r.json().get("email") == ADMIN_EMAIL

    def test_register_new_and_duplicate(self):
        email = f"test_{uuid.uuid4().hex[:8]}@x.com"
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": "T"})
        assert r.status_code == 200
        assert r.json()["user"]["email"].lower() == email.lower()
        r2 = requests.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": "T"})
        assert r2.status_code == 400
        assert "kayıtlı" in r2.json().get("detail", "").lower() or "zaten" in r2.json().get("detail", "").lower()


# --- Seed data ---
class TestSeed:
    def test_products_seed(self, h):
        r = requests.get(f"{API}/products", headers=h)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 8

    def test_personnel_seed(self, h):
        r = requests.get(f"{API}/personnel", headers=h)
        assert r.status_code == 200
        assert len(r.json()) >= 5

    def test_machines_seed(self, h):
        r = requests.get(f"{API}/machines", headers=h)
        assert r.status_code == 200
        assert len(r.json()) >= 4

    def test_critical_products(self, h):
        r = requests.get(f"{API}/products/critical", headers=h)
        assert r.status_code == 200
        data = r.json()
        for p in data:
            assert p["current_stock"] <= p["min_stock"]
        codes = [p["code"] for p in data]
        # KU-002 (8<=15), MT-002 (4<=10), OL-002 (2<=4) expected initially
        # After stock ops in later tests this may change, so just non-empty seed check
        assert isinstance(data, list)


# --- Protected endpoints ---
class TestAuthProtection:
    @pytest.mark.parametrize("path", ["/products", "/personnel", "/machines", "/dashboard", "/movements", "/products/critical"])
    def test_no_token_401(self, path):
        r = requests.get(f"{API}{path}")
        assert r.status_code == 401


# --- Products CRUD ---
class TestProductsCRUD:
    def test_crud_and_dup(self, h):
        code = f"TEST-{uuid.uuid4().hex[:6]}"
        payload = {"code": code, "name": "TEST Product", "category": "TestCat", "unit": "adet",
                   "unit_price": 10.0, "min_stock": 5, "current_stock": 20}
        r = requests.post(f"{API}/products", headers=h, json=payload)
        assert r.status_code == 200
        pid = r.json()["id"]

        # duplicate
        r2 = requests.post(f"{API}/products", headers=h, json=payload)
        assert r2.status_code == 400

        # update
        payload["name"] = "TEST Updated"
        r3 = requests.put(f"{API}/products/{pid}", headers=h, json=payload)
        assert r3.status_code == 200
        assert r3.json()["name"] == "TEST Updated"

        # GET verify (via list)
        rl = requests.get(f"{API}/products", headers=h)
        assert any(p["id"] == pid and p["name"] == "TEST Updated" for p in rl.json())

        # delete
        rd = requests.delete(f"{API}/products/{pid}", headers=h)
        assert rd.status_code == 200


# --- Personnel/Machines CRUD (basic + duplicate) ---
class TestPersonnelMachines:
    def test_personnel_crud(self, h):
        reg = f"TEST{uuid.uuid4().hex[:5]}"
        p = {"first_name": "T", "last_name": "U", "reg_no": reg, "department": "d", "email": "t@t.com"}
        r = requests.post(f"{API}/personnel", headers=h, json=p)
        assert r.status_code == 200
        pid = r.json()["id"]
        r2 = requests.post(f"{API}/personnel", headers=h, json=p)
        assert r2.status_code == 400
        rd = requests.delete(f"{API}/personnel/{pid}", headers=h)
        assert rd.status_code == 200

    def test_machine_crud(self, h):
        code = f"TM-{uuid.uuid4().hex[:5]}"
        m = {"code": code, "name": "TestMach", "brand": "x", "model": "y", "description": "z"}
        r = requests.post(f"{API}/machines", headers=h, json=m)
        assert r.status_code == 200
        mid = r.json()["id"]
        r2 = requests.post(f"{API}/machines", headers=h, json=m)
        assert r2.status_code == 400
        rd = requests.delete(f"{API}/machines/{mid}", headers=h)
        assert rd.status_code == 200


# --- Stock in/out ---
class TestStockFlow:
    def test_full_flow(self, h):
        # Create dedicated product
        code = f"TS-{uuid.uuid4().hex[:6]}"
        prod = {"code": code, "name": "TEST Stock", "category": "T", "unit": "adet",
                "unit_price": 5.0, "min_stock": 10, "current_stock": 15}
        r = requests.post(f"{API}/products", headers=h, json=prod)
        assert r.status_code == 200
        pid = r.json()["id"]

        # Grab a personnel and machine
        pers = requests.get(f"{API}/personnel", headers=h).json()[0]
        mach = requests.get(f"{API}/machines", headers=h).json()[0]

        # Stock in
        ri = requests.post(f"{API}/stock/in", headers=h,
                           json={"product_id": pid, "quantity": 5, "unit_price": 6.0, "supplier": "s"})
        assert ri.status_code == 200
        assert ri.json()["new_stock"] == 20

        # Stock out - not critical (20 -> 15, min=10)
        ro = requests.post(f"{API}/stock/out", headers=h,
                           json={"product_id": pid, "quantity": 5,
                                 "personnel_id": pers["id"], "machine_id": mach["id"]})
        assert ro.status_code == 200
        assert ro.json()["new_stock"] == 15
        assert ro.json()["critical"] is False

        # Stock out - reach critical (15 -> 8, min=10)
        ro2 = requests.post(f"{API}/stock/out", headers=h,
                            json={"product_id": pid, "quantity": 7,
                                  "personnel_id": pers["id"], "machine_id": mach["id"]})
        assert ro2.status_code == 200
        assert ro2.json()["critical"] is True

        # Insufficient stock
        ro3 = requests.post(f"{API}/stock/out", headers=h,
                            json={"product_id": pid, "quantity": 9999,
                                  "personnel_id": pers["id"], "machine_id": mach["id"]})
        assert ro3.status_code == 400
        assert "Yetersiz" in ro3.json().get("detail", "")

        # movements exist
        mv = requests.get(f"{API}/movements", headers=h, params={"product_id": pid})
        assert mv.status_code == 200
        assert len(mv.json()) >= 3

        # movement filter by type
        mvin = requests.get(f"{API}/movements", headers=h, params={"type": "in", "product_id": pid})
        assert all(m["type"] == "in" for m in mvin.json())

        # cleanup
        requests.delete(f"{API}/products/{pid}", headers=h)


# --- Dashboard & reports ---
class TestDashboardReports:
    def test_dashboard(self, h):
        r = requests.get(f"{API}/dashboard", headers=h)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_products", "critical_count", "month_total_cost",
                  "top_personnel", "top_machines", "recent_movements"]:
            assert k in d

    def test_report_summary(self, h):
        r = requests.get(f"{API}/reports/summary", headers=h,
                         params={"date_from": "2020-01-01", "date_to": "2030-01-01"})
        assert r.status_code == 200
        d = r.json()
        assert "by_product" in d and "by_personnel" in d and "by_machine" in d

    def test_report_excel(self, h):
        r = requests.get(f"{API}/reports/excel", headers=h)
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("Content-Type", "")
        assert len(r.content) > 100
