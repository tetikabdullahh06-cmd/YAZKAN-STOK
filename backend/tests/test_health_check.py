"""External health check - verify no 'no healthy upstream' errors."""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cnc-sarfiyat.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "takimhane@yazkan.com.tr"
ADMIN_PASS = "123456"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"] if "access_token" in r.json() else r.json().get("token")


def test_frontend_root_200():
    r = requests.get(f"{BASE_URL}/", timeout=15)
    assert r.status_code == 200
    assert "no healthy upstream" not in r.text.lower()


def test_login_three_times_stable():
    times = []
    for i in range(3):
        t0 = time.time()
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
        elapsed = time.time() - t0
        times.append(elapsed)
        assert r.status_code == 200, f"attempt {i}: {r.status_code} {r.text[:200]}"
        data = r.json()
        tok = data.get("access_token") or data.get("token")
        assert tok and len(tok) > 20
        # role check
        user = data.get("user") or {}
        if user:
            assert user.get("role") == "admin"
        assert elapsed < 3.0, f"login took {elapsed:.2f}s (>3s)"
    print(f"login times: {times}")


def test_auth_me(token):
    r = requests.get(f"{BASE_URL}/api/auth/me",
                     headers={"Authorization": f"Bearer {token}"}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data.get("role") == "admin"


def test_products(token):
    r = requests.get(f"{BASE_URL}/api/products",
                     headers={"Authorization": f"Bearer {token}"}, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_dashboard(token):
    r = requests.get(f"{BASE_URL}/api/dashboard",
                     headers={"Authorization": f"Bearer {token}"}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    for k in ("total_products", "critical_products", "recent_movements"):
        assert k in data, f"missing {k} in dashboard response: {list(data.keys())}"


def test_toolholders(token):
    r = requests.get(f"{BASE_URL}/api/toolholders",
                     headers={"Authorization": f"Bearer {token}"}, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
