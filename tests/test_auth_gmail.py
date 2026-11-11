"""Comprehensive Tests for JARVIS Authentication, Google OAuth, and Gmail Integration."""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ["ALLOW_NO_AUTH"] = "false"
os.environ["SQLITE_PATH"] = ":memory:"
os.environ["APP_SECRET_KEY"] = "test_jarvis_secret_key_12345678"

from app import app, store, oauth_svc, gmail_svc
from auth import (
    create_jwt_token,
    decode_jwt_token,
    decrypt_token,
    encrypt_token,
    generate_user_tokens,
    hash_password,
    verify_password,
)
from integrations.google_oauth import GoogleAccountMismatchError


class TestAuthAndGmailSuite(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_password_hashing(self):
        pwd = "SecurePassword123!"
        hashed = hash_password(pwd)
        self.assertNotEqual(pwd, hashed)
        self.assertTrue(verify_password(pwd, hashed))
        self.assertFalse(verify_password("WrongPassword", hashed))

    def test_jwt_tokens(self):
        user_id = "test_usr_001"
        email = "test@jarvis.ai"
        access_token, refresh_token = generate_user_tokens(user_id, email)
        self.assertTrue(access_token)
        self.assertTrue(refresh_token)

        payload = decode_jwt_token(access_token)
        self.assertEqual(payload["sub"], user_id)
        self.assertEqual(payload["email"], email)
        self.assertEqual(payload["type"], "access")

    def test_token_encryption_at_rest(self):
        sensitive_token = "ya29.a0ARrdaM_super_secret_google_oauth_token"
        encrypted = encrypt_token(sensitive_token)
        self.assertNotEqual(sensitive_token, encrypted)
        decrypted = decrypt_token(encrypted)
        self.assertEqual(sensitive_token, decrypted)

    def test_user_registration_and_login_flow(self):
        # 1. Register User A
        reg_data = {
            "full_name": "Tony Stark",
            "email": "tony@stark.com",
            "password": "IronManPassword2026!",
            "confirm_password": "IronManPassword2026!",
        }
        res = self.client.post("/api/auth/register", json=reg_data)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["user"]["email"], "tony@stark.com")
        self.assertTrue("access_token" in data)

        # 2. Duplicate registration rejection
        res_dup = self.client.post("/api/auth/register", json=reg_data)
        self.assertEqual(res_dup.status_code, 409)

        # 3. Login
        login_res = self.client.post("/api/auth/login", json={
            "email": "tony@stark.com",
            "password": "IronManPassword2026!",
        })
        self.assertEqual(login_res.status_code, 200)
        login_data = login_res.get_json()
        token = login_data["access_token"]
        self.assertTrue(token)

        # 4. Profile with token
        headers = {"Authorization": f"Bearer {token}"}
        prof_res = self.client.get("/api/auth/profile", headers=headers)
        self.assertEqual(prof_res.status_code, 200)
        self.assertEqual(prof_res.get_json()["user"]["full_name"], "Tony Stark")

    def test_google_oauth_email_mismatch_rejection(self):
        # Register user
        self.client.post("/api/auth/register", json={
            "full_name": "Bruce Banner",
            "email": "bruce@avengers.org",
            "password": "HulkSmashPassword!",
            "confirm_password": "HulkSmashPassword!",
        })
        login = self.client.post("/api/auth/login", json={
            "email": "bruce@avengers.org",
            "password": "HulkSmashPassword!",
        }).get_json()
        token = login["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Attempt to link an account with non-matching Google email
        # OAuth service will reject if google email != jarvis email
        with self.assertRaises(GoogleAccountMismatchError):
            oauth_svc.connect_account(
                store=store,
                user_id=login["user"]["id"],
                jarvis_email="bruce@avengers.org",
                code="mock_code_mismatch",
            )
            # In real call with different email, GoogleAccountMismatchError is raised

    def test_gmail_mailbox_pagination_and_operations(self):
        # Register user
        reg = self.client.post("/api/auth/register", json={
            "full_name": "Peter Parker",
            "email": "peter@jarvis.ai",
            "password": "SpiderPassword!",
            "confirm_password": "SpiderPassword!",
        }).get_json()
        token = reg["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. List Inbox
        res = self.client.get("/api/gmail/messages?category=inbox&maxResults=2", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")
        self.assertIsInstance(data["messages"], list)
        self.assertLessEqual(len(data["messages"]), 2)

        # 2. Detail of first email
        first_msg = data["messages"][0]
        msg_id = first_msg["id"]
        detail_res = self.client.get(f"/api/gmail/messages/{msg_id}", headers=headers)
        self.assertEqual(detail_res.status_code, 200)
        detail = detail_res.get_json()["message"]
        self.assertEqual(detail["id"], msg_id)
        self.assertTrue("body_plain" in detail)

        # 3. Mark read and star
        star_res = self.client.post(f"/api/gmail/messages/{msg_id}/star", headers=headers)
        self.assertEqual(star_res.status_code, 200)
        self.assertTrue(star_res.get_json()["is_starred"])

        # 4. Search emails
        search_res = self.client.get("/api/gmail/search?q=placement", headers=headers)
        self.assertEqual(search_res.status_code, 200)
        self.assertGreaterEqual(len(search_res.get_json()["messages"]), 1)

        # 5. Email send safety guard (requires confirmation)
        send_req = {
            "to": "boss@dailybugle.com",
            "subject": "Photos of Spider-Man",
            "body": "Here are the photos from downtown.",
            "confirmed": False,
        }
        guard_res = self.client.post("/api/gmail/send", json=send_req, headers=headers)
        self.assertEqual(guard_res.status_code, 200)
        self.assertTrue(guard_res.get_json()["requires_confirmation"])

        # Confirm send
        send_req["confirmed"] = True
        sent_res = self.client.post("/api/gmail/send", json=send_req, headers=headers)
        self.assertEqual(sent_res.status_code, 200)
        self.assertEqual(sent_res.get_json()["status"], "sent")

    def test_user_data_isolation(self):
        # User 1
        u1_res = self.client.post("/api/auth/register", json={
            "full_name": "User One", "email": "user1@domain.com",
            "password": "Password1!", "confirm_password": "Password1!",
        }).get_json()
        token1 = u1_res["access_token"]

        # User 2
        u2_res = self.client.post("/api/auth/register", json={
            "full_name": "User Two", "email": "user2@domain.com",
            "password": "Password2!", "confirm_password": "Password2!",
        }).get_json()
        token2 = u2_res["access_token"]

        # User 1 creates draft
        self.client.post("/api/gmail/drafts", json={
            "to": "secret@domain.com", "subject": "User 1 Secret", "body": "Classified",
        }, headers={"Authorization": f"Bearer {token1}"})

        # User 2 lists drafts -> User 1's draft must NOT appear in User 2's list
        u2_drafts = self.client.get("/api/gmail/messages?category=drafts", headers={"Authorization": f"Bearer {token2}"}).get_json()
        u2_subjects = [d["subject"] for d in u2_drafts["messages"]]
        self.assertNotIn("User 1 Secret", u2_subjects)


if __name__ == "__main__":
    unittest.main()
