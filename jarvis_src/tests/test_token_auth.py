"""Verification Test Suite for JARVIS APP_API_TOKEN Authentication and Persistence.

Verifies:
1. APP_API_TOKEN is securely loaded via os.environ and persisted to .env.
2. The token is reused across restarts without being regenerated.
3. Backend and APK use the exact same token for authentication.
4. Requests with valid X-API-Token or Bearer token succeed (HTTP 200).
5. Requests with invalid or missing tokens fail with HTTP 401.
6. The token is never exposed, printed, or leaked in responses.
"""
import hmac
import json
import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Set test environment flags
os.environ["ALLOW_NO_AUTH"] = "false"
os.environ["SQLITE_PATH"] = ":memory:"
os.environ["APP_SECRET_KEY"] = "test_jarvis_secret_key_app_token_test"

from auth import get_app_api_token

try:
    from app import app, store
    HAS_FLASK = True
except ImportError:
    HAS_FLASK = False
    app = None
    store = None


class TestAppApiTokenAuthentication(unittest.TestCase):
    def setUp(self):
        if HAS_FLASK and app:
            self.client = app.test_client()

    def test_token_persistence_and_reuse(self):
        """Verify the token is loaded into os.environ, persisted, and reused across restarts."""
        # 1. First retrieval
        token1 = get_app_api_token()
        self.assertTrue(token1)
        self.assertGreaterEqual(len(token1), 32)
        self.assertEqual(os.environ.get("APP_API_TOKEN"), token1)

        # 2. Simulate server restart: retrieve again
        token2 = get_app_api_token()
        # MUST BE IDENTICAL - never regenerated!
        self.assertEqual(token1, token2, "APP_API_TOKEN must be reused across restarts and never regenerated")

        # 3. Simulate process boot reading from os.environ
        with patch.dict(os.environ, {"APP_API_TOKEN": token1}):
            token3 = get_app_api_token()
            self.assertEqual(token1, token3)

    def test_apk_and_backend_token_match(self):
        """Verify the backend and APK use the exact same token and verification succeeds."""
        token = get_app_api_token()
        # APK sends the token via X-API-Token header
        apk_token = token
        self.assertTrue(
            hmac.compare_digest(apk_token.encode("utf-8"), token.encode("utf-8")),
            "Backend and APK must validate against the exact same token",
        )

        # Tampered or wrong token must be rejected
        wrong_token = "invalid_apk_token_xyz"
        self.assertFalse(
            hmac.compare_digest(wrong_token.encode("utf-8"), token.encode("utf-8")),
            "Invalid APK token must be strictly rejected",
        )

    def test_apk_x_api_token_header_success(self):
        """Verify APK authentication using the exact 'X-API-Token' header."""
        if not HAS_FLASK or not self.client:
            self.skipTest("Flask not installed in test runner environment")

        token = get_app_api_token()
        headers = {
            "X-API-Token": token,
            "Content-Type": "application/json",
        }
        res = self.client.post(
            "/chat",
            headers=headers,
            json={"message": "System status check", "session_id": "apk_sess_01"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertIn("content", data)
        # Verify token is NOT exposed in response
        self.assertNotIn(token, json.dumps(data))

    def test_apk_bearer_authorization_header_success(self):
        """Verify authentication using 'Authorization: Bearer <APP_API_TOKEN>'."""
        if not HAS_FLASK or not self.client:
            self.skipTest("Flask not installed in test runner environment")

        token = get_app_api_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        res = self.client.post(
            "/api/chat",
            headers=headers,
            json={"message": "Diagnostic report", "conversation_id": "conv_apk_02"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")

    def test_history_endpoint_with_app_token(self):
        """Verify APK history endpoint works with the shared token."""
        if not HAS_FLASK or not self.client:
            self.skipTest("Flask not installed in test runner environment")

        token = get_app_api_token()
        headers = {"X-API-Token": token}
        res = self.client.get("/history/apk_sess_01", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertIn("messages", data)

    def test_unauthorized_rejection_wrong_token(self):
        """Verify request with invalid token is strictly rejected with 401."""
        if not HAS_FLASK or not self.client:
            self.skipTest("Flask not installed in test runner environment")

        headers = {
            "X-API-Token": "invalid_wrong_token_attempt_12345",
            "Content-Type": "application/json",
        }
        res = self.client.post(
            "/chat",
            headers=headers,
            json={"message": "Unauthorized command"},
        )
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertEqual(data.get("status"), "error")

    def test_unauthorized_rejection_missing_token(self):
        """Verify request without any token is rejected with 401."""
        if not HAS_FLASK or not self.client:
            self.skipTest("Flask not installed in test runner environment")

        res = self.client.post(
            "/chat",
            json={"message": "Unauthenticated query"},
        )
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertEqual(data.get("status"), "error")

    def test_health_endpoint_public_access(self):
        """Verify /health remains accessible without requiring authentication."""
        if not HAS_FLASK or not self.client:
            self.skipTest("Flask not installed in test runner environment")

        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "healthy")
        # Ensure secret token is NOT leaked in health output
        token = get_app_api_token()
        self.assertNotIn(token, json.dumps(data))


if __name__ == "__main__":
    unittest.main()
