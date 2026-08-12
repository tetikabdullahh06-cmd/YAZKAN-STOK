"""Iteration 6 — Tool Holders (Takım Tutucular) + is_special product flag + wipe-all."""
import os
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


@pytest.fixture(scope="module")
def admin_h():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "admin"
    return {"Authorization": f"Bearer {data['access_token']}"}


@pytest.fixture(scope="module")
def viewer_h():
    email = f"testviewer_th_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": "Viewer123!", "name": "V"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def a_machine(admin_h):
    """Create a machine to attach tool holders to."""
    code = f"THM{uuid.uuid4().hex[:4].upper()}"
    r = requests.post(f"{API}/machines", headers=admin_h,
                      json={"code": code, "name": f"TEST_TH_Machine_{code}",
                            "type": "CNC Torna"})
    assert r.status_code == 200, r.text
    m = r.json()
    yield m
    requests.delete(f"{API}/machines/{m['id']}", headers=admin_h)


# ---------- ToolHolder CRUD ----------
class TestToolHolderCRUD:
    def test_list_toolholders_both_roles(self, admin_h, viewer_h):
        assert requests.get(f"{API}/toolholders", headers=admin_h).status_code == 200
        assert requests.get(f"{API}/toolholders", headers=viewer_h).status_code == 200

    def test_viewer_cannot_create(self, viewer_h):
        r = requests.post(f"{API}/toolholders", headers=viewer_h,
                          json={"name": "TEST_TH_ViewerFail"})
        assert r.status_code == 403

    def test_admin_create_full_fields(self, admin_h):
        payload = {
            "name": "TEST_TH_Holder1", "brand": "Sandvik", "type": "BT40",
            "length": "120mm", "diameter": "32mm",
            "min_stock": 2, "current_stock": 5, "location": "Raf X"
        }
        r = requests.post(f"{API}/toolholders", headers=admin_h, json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "id" in d
        for k, v in payload.items():
            assert d[k] == v
        # GET verifies persistence
        lst = requests.get(f"{API}/toolholders", headers=admin_h).json()
        assert any(x["id"] == d["id"] and x["name"] == payload["name"] for x in lst)
        # cleanup
        requests.delete(f"{API}/toolholders/{d['id']}", headers=admin_h)

    def test_admin_update(self, admin_h):
        r = requests.post(f"{API}/toolholders", headers=admin_h,
                          json={"name": "TEST_TH_ForUpd", "brand": "A", "current_stock": 1})
        tid = r.json()["id"]
        upd = requests.put(f"{API}/toolholders/{tid}", headers=admin_h,
                           json={"name": "TEST_TH_Updated", "brand": "B", "type": "T1",
                                 "length": "L", "diameter": "D",
                                 "min_stock": 3, "current_stock": 10, "location": "loc"})
        assert upd.status_code == 200, upd.text
        d = upd.json()
        assert d["name"] == "TEST_TH_Updated"
        assert d["brand"] == "B"
        assert d["current_stock"] == 10
        requests.delete(f"{API}/toolholders/{tid}", headers=admin_h)

    def test_viewer_cannot_update_delete(self, admin_h, viewer_h):
        r = requests.post(f"{API}/toolholders", headers=admin_h,
                          json={"name": "TEST_TH_ViewFail"})
        tid = r.json()["id"]
        assert requests.put(f"{API}/toolholders/{tid}", headers=viewer_h,
                            json={"name": "x"}).status_code == 403
        assert requests.delete(f"{API}/toolholders/{tid}", headers=viewer_h).status_code == 403
        requests.delete(f"{API}/toolholders/{tid}", headers=admin_h)

    def test_admin_delete(self, admin_h):
        r = requests.post(f"{API}/toolholders", headers=admin_h,
                          json={"name": "TEST_TH_ToDel"})
        tid = r.json()["id"]
        d = requests.delete(f"{API}/toolholders/{tid}", headers=admin_h)
        assert d.status_code == 200
        # GET returns 404 not applicable (no getone endpoint), verify absent from list
        lst = requests.get(f"{API}/toolholders", headers=admin_h).json()
        assert not any(x["id"] == tid for x in lst)


# ---------- ToolHolder Stock In/Out ----------
class TestToolHolderStockFlow:
    def test_stock_in_increments(self, admin_h):
        r = requests.post(f"{API}/toolholders", headers=admin_h,
                          json={"name": "TEST_TH_InFlow", "current_stock": 2})
        tid = r.json()["id"]
        try:
            r2 = requests.post(f"{API}/toolholders/{tid}/in", headers=admin_h,
                               json={"quantity": 5, "supplier": "TEST_TH_Sup",
                                     "note": "batch1"})
            assert r2.status_code == 200, r2.text
            assert r2.json()["new_stock"] == 7
            # verify movement recorded
            mv = requests.get(f"{API}/toolholder-movements", headers=admin_h,
                              params={"tool_holder_id": tid, "type": "in"}).json()
            assert len(mv) >= 1
            m = mv[0]
            assert m["type"] == "in"
            assert m["quantity"] == 5
            assert m["tool_holder_id"] == tid
        finally:
            requests.delete(f"{API}/toolholders/{tid}", headers=admin_h)

    def test_stock_in_zero_quantity_400(self, admin_h):
        r = requests.post(f"{API}/toolholders", headers=admin_h,
                          json={"name": "TEST_TH_Zero", "current_stock": 1})
        tid = r.json()["id"]
        try:
            r2 = requests.post(f"{API}/toolholders/{tid}/in", headers=admin_h,
                               json={"quantity": 0})
            assert r2.status_code == 400
            r3 = requests.post(f"{API}/toolholders/{tid}/in", headers=admin_h,
                               json={"quantity": -3})
            assert r3.status_code == 400
        finally:
            requests.delete(f"{API}/toolholders/{tid}", headers=admin_h)

    def test_stock_in_viewer_403(self, admin_h, viewer_h):
        r = requests.post(f"{API}/toolholders", headers=admin_h,
                          json={"name": "TEST_TH_InV"})
        tid = r.json()["id"]
        try:
            r2 = requests.post(f"{API}/toolholders/{tid}/in", headers=viewer_h,
                               json={"quantity": 1})
            assert r2.status_code == 403
        finally:
            requests.delete(f"{API}/toolholders/{tid}", headers=admin_h)

    def test_stock_out_with_machine(self, admin_h, a_machine):
        r = requests.post(f"{API}/toolholders", headers=admin_h,
                          json={"name": "TEST_TH_OutFlow", "current_stock": 10})
        tid = r.json()["id"]
        try:
            r2 = requests.post(f"{API}/toolholders/{tid}/out", headers=admin_h,
                               json={"quantity": 3, "machine_id": a_machine["id"],
                                     "note": "attached to F-01"})
            assert r2.status_code == 200, r2.text
            body = r2.json()
            assert body["new_stock"] == 7
            mv = body["movement"]
            assert mv["type"] == "out"
            assert mv["machine_id"] == a_machine["id"]
            assert mv["machine_name"] == a_machine["name"]
            assert mv["machine_code"] == a_machine["code"]
            # also via list endpoint
            lst = requests.get(f"{API}/toolholder-movements", headers=admin_h,
                               params={"tool_holder_id": tid, "type": "out"}).json()
            assert len(lst) == 1
            assert lst[0]["machine_id"] == a_machine["id"]
        finally:
            requests.delete(f"{API}/toolholders/{tid}", headers=admin_h)

    def test_stock_out_insufficient_400(self, admin_h, a_machine):
        r = requests.post(f"{API}/toolholders", headers=admin_h,
                          json={"name": "TEST_TH_Insuf", "current_stock": 1})
        tid = r.json()["id"]
        try:
            r2 = requests.post(f"{API}/toolholders/{tid}/out", headers=admin_h,
                               json={"quantity": 10, "machine_id": a_machine["id"]})
            assert r2.status_code == 400
        finally:
            requests.delete(f"{API}/toolholders/{tid}", headers=admin_h)

    def test_stock_out_invalid_machine_404(self, admin_h):
        r = requests.post(f"{API}/toolholders", headers=admin_h,
                          json={"name": "TEST_TH_BadMc", "current_stock": 10})
        tid = r.json()["id"]
        try:
            r2 = requests.post(f"{API}/toolholders/{tid}/out", headers=admin_h,
                               json={"quantity": 1, "machine_id": "nonexistent-mach-id"})
            assert r2.status_code == 404
        finally:
            requests.delete(f"{API}/toolholders/{tid}", headers=admin_h)

    def test_stock_out_missing_machine_id_422(self, admin_h):
        r = requests.post(f"{API}/toolholders", headers=admin_h,
                          json={"name": "TEST_TH_NoMc", "current_stock": 10})
        tid = r.json()["id"]
        try:
            r2 = requests.post(f"{API}/toolholders/{tid}/out", headers=admin_h,
                               json={"quantity": 1})  # missing machine_id
            assert r2.status_code == 422
        finally:
            requests.delete(f"{API}/toolholders/{tid}", headers=admin_h)

    def test_stock_out_viewer_403(self, admin_h, viewer_h, a_machine):
        r = requests.post(f"{API}/toolholders", headers=admin_h,
                          json={"name": "TEST_TH_OutV", "current_stock": 5})
        tid = r.json()["id"]
        try:
            r2 = requests.post(f"{API}/toolholders/{tid}/out", headers=viewer_h,
                               json={"quantity": 1, "machine_id": a_machine["id"]})
            assert r2.status_code == 403
        finally:
            requests.delete(f"{API}/toolholders/{tid}", headers=admin_h)

    def test_movements_filter(self, admin_h, a_machine):
        # Create 2 holders, in and out on one, verify filter works
        r = requests.post(f"{API}/toolholders", headers=admin_h,
                          json={"name": "TEST_TH_FilterA", "current_stock": 5})
        tid = r.json()["id"]
        try:
            requests.post(f"{API}/toolholders/{tid}/in", headers=admin_h,
                          json={"quantity": 2})
            requests.post(f"{API}/toolholders/{tid}/out", headers=admin_h,
                          json={"quantity": 1, "machine_id": a_machine["id"]})
            lst_all = requests.get(f"{API}/toolholder-movements", headers=admin_h,
                                   params={"tool_holder_id": tid}).json()
            assert len(lst_all) == 2
            lst_in = requests.get(f"{API}/toolholder-movements", headers=admin_h,
                                  params={"tool_holder_id": tid, "type": "in"}).json()
            assert all(m["type"] == "in" for m in lst_in) and len(lst_in) == 1
            lst_out = requests.get(f"{API}/toolholder-movements", headers=admin_h,
                                   params={"tool_holder_id": tid, "type": "out"}).json()
            assert all(m["type"] == "out" for m in lst_out) and len(lst_out) == 1
        finally:
            requests.delete(f"{API}/toolholders/{tid}", headers=admin_h)


# ---------- Toolholders are separate from products ----------
class TestToolHolderIndependent:
    def test_creating_toolholder_does_not_create_product(self, admin_h):
        before = requests.get(f"{API}/products", headers=admin_h).json()
        before_ids = {p["id"] for p in before}
        r = requests.post(f"{API}/toolholders", headers=admin_h,
                          json={"name": "TEST_TH_Isolated"})
        tid = r.json()["id"]
        try:
            after = requests.get(f"{API}/products", headers=admin_h).json()
            after_ids = {p["id"] for p in after}
            new_products = after_ids - before_ids
            assert not new_products, f"toolholder created new products: {new_products}"
            # Also verify no product has name TEST_TH_Isolated
            assert not any(p["name"] == "TEST_TH_Isolated" for p in after)
        finally:
            requests.delete(f"{API}/toolholders/{tid}", headers=admin_h)


# ---------- is_special product flag ----------
class TestIsSpecialFlag:
    def test_create_product_with_is_special_true(self, admin_h):
        r = requests.post(f"{API}/products", headers=admin_h,
                          json={"name": "TEST_Special_Product", "category": "Special",
                                "unit": "adet", "current_stock": 1, "min_stock": 0,
                                "is_special": True})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["is_special"] is True
        pid = d["id"]
        try:
            # GET verifies persistence
            lst = requests.get(f"{API}/products", headers=admin_h).json()
            found = next((p for p in lst if p["id"] == pid), None)
            assert found is not None
            assert found["is_special"] is True
        finally:
            requests.delete(f"{API}/products/{pid}", headers=admin_h)

    def test_create_product_without_is_special_defaults_false(self, admin_h):
        r = requests.post(f"{API}/products", headers=admin_h,
                          json={"name": "TEST_Regular_Product", "category": "Reg",
                                "unit": "adet", "current_stock": 1, "min_stock": 0})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("is_special") is False
        requests.delete(f"{API}/products/{d['id']}", headers=admin_h)

    def test_existing_products_tolerate_missing_field(self, admin_h):
        # simply ensure list endpoint works — pre-existing docs may omit is_special
        r = requests.get(f"{API}/products", headers=admin_h)
        assert r.status_code == 200
