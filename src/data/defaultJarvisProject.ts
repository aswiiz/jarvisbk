import { ZipFileItem } from '../types/zip';

export const ORIGINAL_V1_FILES: Record<string, string> = {
  'JARVIS-main/app.py': `# Original v1.0 app.py
from flask import Flask, jsonify, request
from db import make_store
from jarvis_core import Jarvis

app = Flask(__name__)
store = make_store()
jarvis = Jarvis()

@app.get('/health')
def health():
    return jsonify(status="ok")

@app.post('/chat')
def chat():
    return jsonify(response="Original chat response")
`,
  'JARVIS-main/jarvis_core.py': `# Original v1.0 jarvis_core.py
class Jarvis:
    def __init__(self):
        self.hf_token = os.getenv("HUGGINGFACE_ACCESS_TOKEN")
`,
  'JARVIS-main/db.py': `# Original v1.0 db.py
class MemoryStore:
    pass

class MongoStore:
    pass
`,
  'JARVIS-main/render.yaml': `services:
  - type: web
    name: jarvis-backend
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn app:app --workers 1
`,
};

export const INITIAL_JARVIS_FILES: Record<string, ZipFileItem> = {
  'JARVIS-main/auth.py': {
    path: 'JARVIS-main/auth.py',
    name: 'auth.py',
    size: 8200,
    content: `"""JARVIS User Authentication & Multi-User Security Module."""
import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any, Dict, Optional, Tuple
from flask import g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

SECRET_KEY = "jarvis_super_secret_jwt_key_2026"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 30

def hash_password(password: str) -> str:
    return generate_password_hash(password, method="scrypt")

def verify_password(password: str, hashed: str) -> bool:
    return check_password_hash(hashed, password)

def create_jwt_token(payload: Dict[str, Any]) -> str:
    # Standard HMAC-SHA256 JWT
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
`,
  },
  'JARVIS-main/integrations/google_oauth.py': {
    path: 'JARVIS-main/integrations/google_oauth.py',
    name: 'google_oauth.py',
    size: 8200,
    content: `"""Google OAuth 2.0 Integration with Strict Email Match Validation."""
import logging
import requests
from auth import decrypt_token, encrypt_token

class GoogleAccountMismatchError(Exception):
    pass

class GoogleOAuthService:
    def connect_account(self, store, user_id: str, jarvis_email: str, code: str):
        # Checks that connected Google email strictly matches registered JARVIS email!
        google_email = self.get_google_user_email(access_token)
        if google_email.lower() != jarvis_email.lower():
            raise GoogleAccountMismatchError(
                f"Account mismatch: Google account ({google_email}) does not match JARVIS email ({jarvis_email})."
            )
`,
  },
  'JARVIS-main/integrations/gmail_client.py': {
    path: 'JARVIS-main/integrations/gmail_client.py',
    name: 'gmail_client.py',
    size: 26200,
    content: `"""Complete Gmail API Integration Service for JARVIS.

Supports:
- Full mailbox access with pagination (pageToken / nextPageToken)
- Mailbox categories: INBOX, SENT, DRAFT, STARRED, IMPORTANT, SPAM, TRASH, ALL
- Operations: List, Get, Search, Mark Read/Unread, Star/Unstar, Archive, Trash/Restore, Drafts, Send, Reply, Forward
- Security: User-isolated access, safe sending preview before dispatch
"""
import base64
import requests
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

class GmailService:
    def list_messages(self, store, user_id: str, category="inbox", page_token=None, max_results=15, query=None):
        pass

    def send_email(self, store, user_id: str, to: str, subject: str, body: str, confirmed=False):
        if not confirmed:
            return {"requires_confirmation": True, "action": "send_email", "preview": {"to": to, "subject": subject}}
        # Dispatches via Gmail API after confirmation
        return {"status": "sent", "recipient": to, "subject": subject}
`,
  },
  'JARVIS-main/app.py': {
    path: 'JARVIS-main/app.py',
    name: 'app.py',
    size: 30300,
    originalContent: ORIGINAL_V1_FILES['JARVIS-main/app.py'],
    content: `"""Production Flask Backend for JARVIS with Authentication and Gmail API."""
from flask import Flask, jsonify, request
from auth import require_auth
from db import make_store
from integrations.gmail_client import GmailService
from integrations.google_oauth import GoogleOAuthService

app = Flask(__name__)
# User Auth APIs: /api/auth/register, /api/auth/login, /api/auth/refresh, /api/auth/profile
# Google OAuth: /api/auth/google/start, /api/auth/google/connect, /api/auth/google/status
# Gmail APIs: /api/gmail/messages, /api/gmail/search, /api/gmail/send, /api/gmail/drafts
# AI Assistant: /api/chat, /api/chat/stream
`,
  },
  'JARVIS-main/db.py': {
    path: 'JARVIS-main/db.py',
    name: 'db.py',
    size: 26400,
    originalContent: ORIGINAL_V1_FILES['JARVIS-main/db.py'],
    content: `"""Multi-User Database Layer with User Isolation and Token Encryption."""
class SQLiteStore:
    # Users, RefreshTokens, GoogleAccounts, Conversations, Messages
    pass
`,
  },
  'JARVIS-main/render.yaml': {
    path: 'JARVIS-main/render.yaml',
    name: 'render.yaml',
    size: 1300,
    originalContent: ORIGINAL_V1_FILES['JARVIS-main/render.yaml'],
    content: `services:
  - type: web
    name: jarvis-backend
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn app:app --workers 1 --threads 4 --timeout 300 --bind 0.0.0.0:$PORT
    healthCheckPath: /health
`,
  },
  'JARVIS-main/requirements.txt': {
    path: 'JARVIS-main/requirements.txt',
    name: 'requirements.txt',
    size: 200,
    content: `flask==3.0.3
flask-cors==4.0.1
gunicorn==22.0.0
openai>=1.40,<3
requests>=2.32
python-dotenv>=1.0
PyJWT>=2.8.0
cryptography>=42.0.0
`,
  },
  'JARVIS-main/README.md': {
    path: 'JARVIS-main/README.md',
    name: 'README.md',
    size: 7100,
    content: `# JARVIS AI Assistant Backend v2.1
Complete User Authentication, Google OAuth with Email Match Guard, and Full Gmail Integration.
`,
  },
};
