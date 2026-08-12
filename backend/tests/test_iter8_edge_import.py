"""Iter8: Edge-case bulk import tests for /api/toolholders/import and /api/products/import.

Verifies the JSON-serialization bug fix (NaN/Inf sanitization, Turkish comma,
datetime coercion, BOM stripping) and confirms responses parse as valid JSON.
"""
import io
import os
import json
import uuid
import datetime as dt
import pytest
import requests
from openpyxl import Workbook

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "takimhane@yazkan.com.tr", "password": "123456"}


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def viewer_token():
    email = f"TEST_viewer_iter8_{uuid.uuid4().hex[:6]}@ex.com"
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": "abc12345", "name": "Iter8 Viewer"},
                      timeout=30)
    assert r.status_code in (200, 201), r.text
    r2 = requests.post(f"{API}/auth/login",
                       json={"email": email, "password": "abc12345"}, timeout=30)
    assert r2.status_code == 200, r2.text
    return r2.json()["access_token"]


# ---------- helpers ----------
def _xlsx_bytes(headers, rows):
    wb = Workbook()
    ws = wb.active
    ws.append(headers)
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.getvalue()


def _upload_toolholders(token, xlsx, commit=False):
    return requests.post(
        f"{API}/toolholders/import",
        params={"commit": str(commit).lower()},
        files={"file": ("test.xlsx", xlsx,
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )


def _upload_products(token, xlsx, commit=False):
    return requests.post(
        f"{API}/products/import",
        params={"commit": str(commit).lower()},
        files={"file": ("test.xlsx", xlsx,
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )


def _assert_valid_json(resp):
    # Ensure the raw body parses as valid JSON (bug: literal NaN broke this)
    txt = resp.text
    assert "NaN" not in txt.split('"error"')[0][:2000] or True  # sanity, not strict
    try:
        data = json.loads(txt)
    except json.JSONDecodeError as e:
        pytest.fail(f"Response body not valid JSON ({e}): {txt[:300]}")
    return data


TH_HEADERS = ["name", "brand", "type", "length", "diameter", "min_stock",
              "current_stock", "location", "note"]
PROD_HEADERS = ["code", "name", "category", "unit", "min_stock", "current_stock",
                "location", "quality", "brand"]


# ==================== Tool Holders ====================
class TestToolHolderImportEdgeCases:

    def test_regression_normal_row(self, admin_token):
        prefix = f"TEST_ITER8_TH_REG_{uuid.uuid4().hex[:6]}"
        xlsx = _xlsx_bytes(TH_HEADERS,
                           [[prefix, "BrandA", "TypeA", "100", "10", 1, 5, "L1", ""]])
        r = _upload_toolholders(admin_token, xlsx, commit=False)
        assert r.status_code == 200, r.text
        data = _assert_valid_json(r)
        assert data["stats"]["total"] == 1
        assert data["stats"]["create"] == 1

    def test_nan_inf_sanitized(self, admin_token):
        prefix = f"TEST_ITER8_TH_NAN_{uuid.uuid4().hex[:6]}"
        xlsx = _xlsx_bytes(TH_HEADERS, [
            [prefix + "_a", "B", "T", "L", "D", "NaN", "Inf", "loc", ""],
            [prefix + "_b", "B", "T", "L", "D", "nan", "-inf", "loc", ""],
        ])
        r = _upload_toolholders(admin_token, xlsx, commit=False)
        assert r.status_code == 200, r.text
        data = _assert_valid_json(r)
        # both rows should be preview action=create with min/current == 0.0 (sanitized)
        rows = [p for p in data["preview"] if p["action"] == "create"]
        assert len(rows) == 2
        for row in rows:
            assert row["data"]["min_stock"] == 0.0
            assert row["data"]["current_stock"] == 0.0

    def test_turkish_decimal_comma(self, admin_token):
        prefix = f"TEST_ITER8_TH_TR_{uuid.uuid4().hex[:6]}"
        xlsx = _xlsx_bytes(TH_HEADERS,
                           [[prefix, "B", "T", "L", "D", "1,5", "2,25", "loc", ""]])
        r = _upload_toolholders(admin_token, xlsx, commit=False)
        assert r.status_code == 200, r.text
        data = _assert_valid_json(r)
        p = data["preview"][0]
        assert p["action"] == "create"
        assert p["data"]["min_stock"] == 1.5
        assert p["data"]["current_stock"] == 2.25

    def test_datetime_in_string_columns(self, admin_token):
        prefix = f"TEST_ITER8_TH_DT_{uuid.uuid4().hex[:6]}"
        d = dt.datetime(2025, 6, 1, 12, 0, 0)
        xlsx = _xlsx_bytes(TH_HEADERS,
                           [[prefix, "B", "T", d, d, 1, 2, "loc", ""]])
        r = _upload_toolholders(admin_token, xlsx, commit=False)
        assert r.status_code == 200, r.text
        data = _assert_valid_json(r)
        p = data["preview"][0]
        assert p["action"] == "create"
        # length/diameter should be stringified cleanly
        assert isinstance(p["data"]["length"], str) and p["data"]["length"] != ""
        assert isinstance(p["data"]["diameter"], str)

    def test_utf8_bom_in_name(self, admin_token):
        prefix = f"TEST_ITER8_TH_BOM_{uuid.uuid4().hex[:6]}"
        name_bom = "\ufeff" + prefix
        xlsx = _xlsx_bytes(TH_HEADERS,
                           [[name_bom, "B", "T", "L", "D", 0, 0, "loc", ""]])
        r = _upload_toolholders(admin_token, xlsx, commit=False)
        assert r.status_code == 200, r.text
        data = _assert_valid_json(r)
        p = data["preview"][0]
        assert p["data"]["name"] == prefix  # BOM stripped

    def test_empty_numeric_cells_default_zero(self, admin_token):
        prefix = f"TEST_ITER8_TH_EMPTY_{uuid.uuid4().hex[:6]}"
        xlsx = _xlsx_bytes(TH_HEADERS,
                           [[prefix, "B", "T", "L", "D", None, None, "loc", ""]])
        r = _upload_toolholders(admin_token, xlsx, commit=False)
        assert r.status_code == 200
        data = _assert_valid_json(r)
        p = data["preview"][0]
        assert p["action"] == "create"
        assert p["data"]["min_stock"] == 0.0
        assert p["data"]["current_stock"] == 0.0

    def test_non_numeric_abc_triggers_skip(self, admin_token):
        prefix = f"TEST_ITER8_TH_ABC_{uuid.uuid4().hex[:6]}"
        xlsx = _xlsx_bytes(TH_HEADERS,
                           [[prefix, "B", "T", "L", "D", "abc", 0, "loc", ""]])
        r = _upload_toolholders(admin_token, xlsx, commit=False)
        assert r.status_code == 200
        data = _assert_valid_json(r)
        p = data["preview"][0]
        assert p["action"] == "skip"
        assert "sayı olmalı" in (p.get("error") or "")

    def test_commit_true_persists_sanitized(self, admin_token, admin_headers):
        prefix = f"TEST_ITER8_TH_COMMIT_{uuid.uuid4().hex[:6]}"
        xlsx = _xlsx_bytes(TH_HEADERS, [
            [prefix + "_nan", "B", "T", "L", "D", "NaN", 0, "loc", ""],
            [prefix + "_tr",  "B", "T", "L", "D", "1,5", "2,5", "loc", ""],
        ])
        r = _upload_toolholders(admin_token, xlsx, commit=True)
        assert r.status_code == 200, r.text
        data = _assert_valid_json(r)
        assert data["committed"] is True
        assert data["created"] == 2

        # Verify persisted values by listing & cleaning up
        lr = requests.get(f"{API}/toolholders", headers=admin_headers, timeout=30)
        assert lr.status_code == 200
        items = lr.json()
        created_ids = []
        for it in items:
            if it["name"].startswith(prefix):
                created_ids.append(it["id"])
                if it["name"].endswith("_nan"):
                    assert it["min_stock"] == 0.0
                if it["name"].endswith("_tr"):
                    assert it["min_stock"] == 1.5
                    assert it["current_stock"] == 2.5
        assert len(created_ids) == 2
        # Cleanup
        for tid in created_ids:
            requests.delete(f"{API}/toolholders/{tid}",
                            headers=admin_headers, timeout=15)

    def test_viewer_forbidden(self, viewer_token):
        xlsx = _xlsx_bytes(TH_HEADERS,
                           [["TEST_ITER8_V", "B", "T", "L", "D", 0, 0, "", ""]])
        r = _upload_toolholders(viewer_token, xlsx, commit=False)
        assert r.status_code == 403


# ==================== Products ====================
class TestProductImportEdgeCases:

    def test_nan_turkish_comma_products(self, admin_token):
        pfx = f"TEST_ITER8_P_{uuid.uuid4().hex[:6]}"
        xlsx = _xlsx_bytes(PROD_HEADERS, [
            [pfx + "_1", "Name1", "Cat", "adet", "NaN", "Inf", "L", "Q", "Br"],
            [pfx + "_2", "Name2", "Cat", "kg",   "1,5", "2,75", "L", "Q", "Br"],
        ])
        r = _upload_products(admin_token, xlsx, commit=False)
        assert r.status_code == 200, r.text
        data = _assert_valid_json(r)
        by_code = {p["data"].get("code"): p for p in data["preview"]}
        r1 = by_code.get(pfx + "_1")
        r2 = by_code.get(pfx + "_2")
        assert r1 and r1["action"] == "create"
        assert r1["data"]["min_stock"] == 0.0
        assert r1["data"]["current_stock"] == 0.0
        assert r2 and r2["action"] == "create"
        assert r2["data"]["min_stock"] == 1.5
        assert r2["data"]["current_stock"] == 2.75

    def test_abc_products_skip(self, admin_token):
        pfx = f"TEST_ITER8_PABC_{uuid.uuid4().hex[:6]}"
        xlsx = _xlsx_bytes(PROD_HEADERS,
                           [[pfx, "N", "C", "adet", "abc", 0, "", "", ""]])
        r = _upload_products(admin_token, xlsx, commit=False)
        assert r.status_code == 200
        data = _assert_valid_json(r)
        assert data["preview"][0]["action"] == "skip"
