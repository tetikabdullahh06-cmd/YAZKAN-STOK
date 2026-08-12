"""RBAC (iteration 5) — role-based access control tests.

Admin (takimhane@yazkan.com.tr / Admin123!) = the ONLY account that can mutate.
Every newly registered user gets role='viewer' and gets 403 on POST/PUT/DELETE.
Auth check (401) must precede role check (403).
"""
import os
import io
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"
ADMIN_EMAIL = "takimhane@yazkan.com.tr"
ADMIN_PW = "123456"
LEGACY_EMAIL = "tetikabdullahh06@gmail.com"

EXPECTED_403_DETAIL = "Bu işlem için yönetici yetkisi gerekli. Sadece görüntüleme yapabilirsiniz."


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "admin", f"admin login returned role={data['user'].get('role')}"
    assert "access_token" in data
    return data["access_token"]


@pytest.fixture(scope="session")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def viewer_creds():
    """Register a fresh viewer. Session-scoped so all tests share it."""
    email = f"testviewer_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": "Viewer123!", "name": "Test Viewer"})
    assert r.status_code == 200, f"viewer register failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "viewer", f"register did not assign viewer role: {data['user']}"
    assert "access_token" in data
    yield {"email": email, "token": data["access_token"], "user": data["user"]}
    # Cleanup: remove test viewer from DB
    try:
        import subprocess
        subprocess.run(
            ["mongosh", "test_database", "--quiet", "--eval",
             f"db.users.deleteOne({{email:'{email}'}})"],
            capture_output=True, timeout=10)
    except Exception as e:
        print(f"cleanup warn: {e}")


@pytest.fixture(scope="session")
def viewer_h(viewer_creds):
    return {"Authorization": f"Bearer {viewer_creds['token']}"}


# ---------- Login / register / me role plumbing ----------
class TestAuthRolePlumbing:
    def test_admin_login_returns_role_admin(self, admin_token):
        # covered in fixture assertion; just re-assert token nonempty
        assert len(admin_token) > 20

    def test_admin_me_returns_role_admin(self, admin_h):
        r = requests.get(f"{API}/auth/me", headers=admin_h)
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == ADMIN_EMAIL
        assert body["role"] == "admin"

    def test_register_returns_viewer_role_and_token(self, viewer_creds):
        assert viewer_creds["user"]["role"] == "viewer"
        assert isinstance(viewer_creds["token"], str) and len(viewer_creds["token"]) > 20

    def test_viewer_me_returns_role_viewer(self, viewer_h):
        r = requests.get(f"{API}/auth/me", headers=viewer_h)
        assert r.status_code == 200
        assert r.json()["role"] == "viewer"

    def test_legacy_user_is_viewer_if_exists(self):
        """If legacy admin still exists, migration should have demoted to viewer."""
        r = requests.post(f"{API}/auth/login",
                          json={"email": LEGACY_EMAIL, "password": ADMIN_PW})
        if r.status_code != 200:
            pytest.skip(f"legacy user not present or password differs (status {r.status_code})")
        body = r.json()
        assert body["user"]["role"] == "viewer", \
            f"legacy user {LEGACY_EMAIL} still has role={body['user']['role']}, expected viewer"


# ---------- Viewer READ access ----------
class TestViewerCanRead:
    @pytest.mark.parametrize("path", [
        "/products", "/personnel", "/machines", "/suppliers",
        "/orders", "/movements", "/dashboard",
        "/reports/summary", "/products/critical",
    ])
    def test_viewer_get_ok(self, viewer_h, path):
        r = requests.get(f"{API}{path}", headers=viewer_h)
        assert r.status_code == 200, f"GET {path} failed: {r.status_code} {r.text[:200]}"

    def test_viewer_reports_excel(self, viewer_h):
        r = requests.get(f"{API}/reports/excel", headers=viewer_h)
        assert r.status_code == 200
        assert len(r.content) > 100  # non-empty xlsx


# ---------- Viewer mutation → 403 matrix ----------
def _assert_403(r, endpoint_label):
    assert r.status_code == 403, f"{endpoint_label} expected 403, got {r.status_code}: {r.text[:200]}"
    try:
        detail = r.json().get("detail", "")
    except Exception:
        detail = ""
    # Turkish message check (partial match — tolerant to trailing period differences)
    assert "yönetici yetkisi" in detail, \
        f"{endpoint_label} 403 detail unexpected: {detail!r}"


class TestViewerCannotMutate:
    # products
    def test_viewer_post_products(self, viewer_h):
        r = requests.post(f"{API}/products", headers=viewer_h,
                          json={"code": "", "name": "x", "category": "y", "unit": "adet",
                                "current_stock": 0, "min_stock": 0})
        _assert_403(r, "POST /products")

    def test_viewer_put_products_nonexistent(self, viewer_h):
        # role check must precede 404 lookup
        r = requests.put(f"{API}/products/nonexistent-id", headers=viewer_h,
                         json={"code": "X", "name": "x", "category": "y", "unit": "adet",
                               "current_stock": 0, "min_stock": 0})
        _assert_403(r, "PUT /products/{nonexistent}")

    def test_viewer_delete_products(self, viewer_h):
        r = requests.delete(f"{API}/products/nonexistent-id", headers=viewer_h)
        _assert_403(r, "DELETE /products/{id}")

    # personnel
    def test_viewer_post_personnel(self, viewer_h):
        r = requests.post(f"{API}/personnel", headers=viewer_h,
                          json={"first_name": "T", "last_name": "V", "department": "x"})
        _assert_403(r, "POST /personnel")

    def test_viewer_put_personnel(self, viewer_h):
        r = requests.put(f"{API}/personnel/xxx", headers=viewer_h,
                         json={"first_name": "T", "last_name": "V", "department": "x"})
        _assert_403(r, "PUT /personnel/{id}")

    def test_viewer_delete_personnel(self, viewer_h):
        r = requests.delete(f"{API}/personnel/xxx", headers=viewer_h)
        _assert_403(r, "DELETE /personnel/{id}")

    # machines
    def test_viewer_post_machines(self, viewer_h):
        r = requests.post(f"{API}/machines", headers=viewer_h,
                          json={"code": "M1", "name": "m", "type": "CNC Torna"})
        _assert_403(r, "POST /machines")

    def test_viewer_put_machines(self, viewer_h):
        r = requests.put(f"{API}/machines/xxx", headers=viewer_h,
                         json={"code": "M1", "name": "m", "type": "CNC Torna"})
        _assert_403(r, "PUT /machines/{id}")

    def test_viewer_delete_machines(self, viewer_h):
        r = requests.delete(f"{API}/machines/xxx", headers=viewer_h)
        _assert_403(r, "DELETE /machines/{id}")

    # stock
    def test_viewer_post_stock_in(self, viewer_h):
        r = requests.post(f"{API}/stock/in", headers=viewer_h,
                          json={"product_id": "x", "quantity": 1})
        _assert_403(r, "POST /stock/in")

    def test_viewer_post_stock_out(self, viewer_h):
        r = requests.post(f"{API}/stock/out", headers=viewer_h,
                          json={"product_id": "x", "quantity": 1,
                                "personnel_id": "p", "machine_id": "m"})
        _assert_403(r, "POST /stock/out")

    # suppliers
    def test_viewer_post_suppliers(self, viewer_h):
        r = requests.post(f"{API}/suppliers", headers=viewer_h, json={"name": "S"})
        _assert_403(r, "POST /suppliers")

    def test_viewer_put_suppliers(self, viewer_h):
        r = requests.put(f"{API}/suppliers/xxx", headers=viewer_h, json={"name": "S"})
        _assert_403(r, "PUT /suppliers/{id}")

    def test_viewer_delete_suppliers(self, viewer_h):
        r = requests.delete(f"{API}/suppliers/xxx", headers=viewer_h)
        _assert_403(r, "DELETE /suppliers/{id}")

    # orders
    def test_viewer_post_orders(self, viewer_h):
        r = requests.post(f"{API}/orders", headers=viewer_h,
                          json={"supplier_id": "x", "items": []})
        _assert_403(r, "POST /orders")

    def test_viewer_post_order_close(self, viewer_h):
        r = requests.post(f"{API}/orders/xxx/close", headers=viewer_h)
        _assert_403(r, "POST /orders/{id}/close")

    def test_viewer_post_order_receive(self, viewer_h):
        r = requests.post(f"{API}/orders/xxx/receive", headers=viewer_h,
                          json={"product_id": "x", "quantity": 1})
        _assert_403(r, "POST /orders/{id}/receive")

    def test_viewer_delete_orders(self, viewer_h):
        r = requests.delete(f"{API}/orders/xxx", headers=viewer_h)
        _assert_403(r, "DELETE /orders/{id}")

    # imports & admin ops
    def test_viewer_products_import(self, viewer_h):
        # send a bogus small file — role check happens before parse
        files = {"file": ("x.xlsx", b"not-a-real-xlsx",
                          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        r = requests.post(f"{API}/products/import", headers=viewer_h, files=files)
        _assert_403(r, "POST /products/import")

    def test_viewer_send_daily_digest(self, viewer_h):
        r = requests.post(f"{API}/admin/send-daily-digest", headers=viewer_h)
        _assert_403(r, "POST /admin/send-daily-digest")


# ---------- 401 precedes 403 (unauth vs viewer) ----------
class TestAuthBeforeRole:
    def test_no_token_post_products_401(self):
        r = requests.post(f"{API}/products",
                          json={"code": "X", "name": "n", "category": "c",
                                "unit": "adet", "current_stock": 0, "min_stock": 0})
        assert r.status_code == 401, f"expected 401 got {r.status_code}"

    def test_no_token_delete_products_401(self):
        r = requests.delete(f"{API}/products/anything")
        assert r.status_code == 401

    def test_bad_token_post_products_401(self):
        r = requests.post(f"{API}/products",
                          headers={"Authorization": "Bearer garbage.token.value"},
                          json={"code": "X", "name": "n", "category": "c",
                                "unit": "adet", "current_stock": 0, "min_stock": 0})
        assert r.status_code == 401


# ---------- Admin CAN still mutate everything ----------
class TestAdminCanMutate:
    """End-to-end mutation smoke test as admin, covers all resources."""

    def test_admin_full_flow(self, admin_h):
        # Create product with auto YZK
        p = requests.post(f"{API}/products", headers=admin_h, json={
            "code": "", "name": "TEST_RBAC_Product", "category": "Test",
            "unit": "adet", "current_stock": 5, "min_stock": 1,
            "location": "A1", "quality": "std", "brand": "test"
        })
        assert p.status_code == 200, p.text
        prod = p.json()
        assert prod["code"].startswith("YZK")
        pid = prod["id"]

        # Update product
        u = requests.put(f"{API}/products/{pid}", headers=admin_h, json={
            "code": prod["code"], "name": "TEST_RBAC_Product2", "category": "Test",
            "unit": "adet", "current_stock": 5, "min_stock": 1,
        })
        assert u.status_code == 200, u.text

        # Personnel
        pn = requests.post(f"{API}/personnel", headers=admin_h, json={
            "first_name": "TEST_RBAC", "last_name": "User", "department": "Test"
        })
        assert pn.status_code == 200, pn.text
        pn_id = pn.json()["id"]

        # Machine
        mch_code = f"TESTM{uuid.uuid4().hex[:4].upper()}"
        m = requests.post(f"{API}/machines", headers=admin_h, json={
            "code": mch_code, "name": "TEST_RBAC_Machine", "type": "CNC Torna"
        })
        assert m.status_code == 200, m.text
        mch_id = m.json()["id"]

        # Stock in
        si = requests.post(f"{API}/stock/in", headers=admin_h,
                           json={"product_id": pid, "quantity": 10})
        assert si.status_code == 200, si.text

        # Stock out
        so = requests.post(f"{API}/stock/out", headers=admin_h, json={
            "product_id": pid, "quantity": 2,
            "personnel_id": pn_id, "machine_id": mch_id
        })
        assert so.status_code == 200, so.text

        # Supplier
        s = requests.post(f"{API}/suppliers", headers=admin_h,
                          json={"name": f"TEST_RBAC_Sup_{uuid.uuid4().hex[:4]}"})
        assert s.status_code == 200, s.text
        sid = s.json()["id"]

        s2 = requests.put(f"{API}/suppliers/{sid}", headers=admin_h,
                         json={"name": f"TEST_RBAC_Sup_upd_{uuid.uuid4().hex[:4]}"})
        assert s2.status_code == 200, s2.text

        # Order (select item)
        o = requests.post(f"{API}/orders", headers=admin_h, json={
            "supplier_id": sid,
            "items": [{"product_id": pid, "quantity": 3}]
        })
        assert o.status_code == 200, o.text
        oid = o.json()["id"]

        # Receive partial
        rcv = requests.post(f"{API}/orders/{oid}/receive", headers=admin_h,
                            json={"items": [{"product_id": pid, "quantity": 1}]})
        assert rcv.status_code == 200, rcv.text

        # Close order
        c = requests.post(f"{API}/orders/{oid}/close", headers=admin_h)
        assert c.status_code == 200, c.text

        # Cleanup
        requests.delete(f"{API}/suppliers/{sid}", headers=admin_h)
        requests.delete(f"{API}/personnel/{pn_id}", headers=admin_h)
        requests.delete(f"{API}/machines/{mch_id}", headers=admin_h)
        requests.delete(f"{API}/products/{pid}", headers=admin_h)
