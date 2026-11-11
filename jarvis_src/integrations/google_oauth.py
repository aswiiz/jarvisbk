"""Google OAuth 2.0 Integration Module for JARVIS.

Handles:
- Minimum required OAuth scopes for Gmail & Calendar
- Authorization URL generation with state security token
- Authorization code exchange for Access & Refresh tokens
- User profile verification and CRITICAL email matching:
  Rejects connection if Google account email does not match registered JARVIS email!
- Access token refresh via Google OAuth endpoint
"""
import logging
import os
import time
from typing import Any, Dict, Optional, Tuple
import requests

from auth import decrypt_token, encrypt_token

log = logging.getLogger("jarvis.google_oauth")

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

GMAIL_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar",
]


class GoogleAccountMismatchError(Exception):
    """Raised when the connected Google email does not match the JARVIS account email."""
    pass


class GoogleOAuthService:
    def __init__(self):
        self.client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
        self.client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
        self.redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "").strip() or "http://localhost:8000/api/auth/google/callback"

    def is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret)

    def get_authorization_url(self, state: str, redirect_uri: Optional[str] = None, scopes: Optional[list] = None) -> str:
        """Generate Google OAuth 2.0 consent screen URL."""
        if not self.is_configured():
            # In sandbox/demo mode, return a simulated OAuth link
            uri = redirect_uri or self.redirect_uri
            return f"/api/auth/google/mock-consent?state={state}&redirect_uri={requests.utils.quote(uri)}"

        chosen_scopes = scopes or GMAIL_SCOPES
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri or self.redirect_uri,
            "response_type": "code",
            "scope": " ".join(chosen_scopes),
            "access_type": "offline",  # Request refresh token
            "prompt": "consent",        # Force consent to ensure refresh token is returned
            "state": state,
        }
        query_string = "&".join(f"{k}={requests.utils.quote(str(v))}" for k, v in params.items())
        return f"{GOOGLE_AUTH_URL}?{query_string}"

    def exchange_code_for_tokens(self, code: str, redirect_uri: Optional[str] = None) -> Dict[str, Any]:
        """Exchange authorization code for access and refresh tokens."""
        if not self.is_configured():
            # Mock exchange for demo / testing
            return {
                "access_token": f"mock_google_access_token_{code[:8]}",
                "refresh_token": f"mock_google_refresh_token_{code[:8]}",
                "expires_in": 3600,
                "scope": " ".join(GMAIL_SCOPES),
            }

        payload = {
            "code": code,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "redirect_uri": redirect_uri or self.redirect_uri,
            "grant_type": "authorization_code",
        }
        res = requests.post(GOOGLE_TOKEN_URL, data=payload, timeout=15)
        if res.status_code != 200:
            raise ValueError(f"Google token exchange failed ({res.status_code}): {res.text[:200]}")
        return res.json()

    def get_google_user_email(self, access_token: str) -> str:
        """Fetch email address from Google userinfo."""
        if access_token.startswith("mock_google_"):
            return "user@jarvis.ai"

        headers = {"Authorization": f"Bearer {access_token}"}
        res = requests.get(GOOGLE_USERINFO_URL, headers=headers, timeout=10)
        if res.status_code != 200:
            raise ValueError(f"Failed to fetch Google profile: {res.text[:200]}")
        return res.json().get("email", "").strip().lower()

    def connect_account(self, store, user_id: str, jarvis_email: str, code: str, redirect_uri: Optional[str] = None) -> Dict[str, Any]:
        """Verify email match, encrypt credentials, and link Google account to user."""
        token_data = self.exchange_code_for_tokens(code, redirect_uri)
        access_token = token_data.get("access_token", "")
        refresh_token = token_data.get("refresh_token", "")
        expires_in = int(token_data.get("expires_in", 3600))
        scope = token_data.get("scope", "")

        # Fetch Google email
        google_email = self.get_google_user_email(access_token)
        if not google_email:
            # If mock mode, fall back to jarvis_email
            google_email = jarvis_email.strip().lower()

        # CRITICAL VALIDATION: Connected Google account must match registered JARVIS email
        if google_email.lower() != jarvis_email.strip().lower():
            log.warning("Google account mismatch: Google=%s vs JARVIS=%s", google_email, jarvis_email)
            raise GoogleAccountMismatchError(
                f"Account mismatch: The Google account you logged into ({google_email}) does not match your registered JARVIS email ({jarvis_email}). Please log in with the correct Google account."
            )

        token_expiry = time.time() + expires_in
        # Encrypt tokens at rest
        enc_access = encrypt_token(access_token)
        enc_refresh = encrypt_token(refresh_token) if refresh_token else ""

        saved = store.save_google_account(
            user_id=user_id,
            google_email=google_email,
            access_token=enc_access,
            refresh_token=enc_refresh,
            token_expiry=token_expiry,
            scope=scope,
        )
        return saved

    def get_valid_access_token(self, store, user_id: str) -> Optional[str]:
        """Retrieve access token for user, automatically refreshing if expired."""
        acct = store.get_google_account(user_id)
        if not acct:
            return None

        access_token = decrypt_token(acct["access_token"])
        refresh_token = decrypt_token(acct.get("refresh_token", ""))
        token_expiry = acct.get("token_expiry", 0)

        # Check if expired or within 60 seconds of expiry
        if time.time() > (token_expiry - 60):
            if not refresh_token:
                log.warning("Google access token expired and no refresh token for user %s", user_id)
                return access_token  # Return best effort

            refreshed = self.refresh_access_token(refresh_token)
            if refreshed:
                new_access = refreshed["access_token"]
                new_expiry = time.time() + int(refreshed.get("expires_in", 3600))
                store.save_google_account(
                    user_id=user_id,
                    google_email=acct["google_email"],
                    access_token=encrypt_token(new_access),
                    refresh_token=encrypt_token(refresh_token),
                    token_expiry=new_expiry,
                    scope=acct.get("scope", ""),
                )
                return new_access

        return access_token

    def refresh_access_token(self, refresh_token: str) -> Optional[Dict[str, Any]]:
        """Call Google token endpoint to refresh expired access token."""
        if refresh_token.startswith("mock_google_"):
            return {"access_token": f"mock_refreshed_access_token_{int(time.time())}", "expires_in": 3600}

        if not self.is_configured():
            return None

        payload = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
        res = requests.post(GOOGLE_TOKEN_URL, data=payload, timeout=10)
        if res.status_code == 200:
            return res.json()
        log.warning("Google token refresh failed: %s", res.text[:200])
        return None
