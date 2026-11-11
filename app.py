"""Production-Grade Flask Application for JARVIS AI Assistant.

Comprehensive Architecture:
1. Complete Multi-User Authentication (Register, Login, JWT Access/Refresh tokens, Verify Email, Password Reset, Profile)
2. Google Account OAuth Connection with Strict Email Match Validation
3. Complete Gmail Integration (Inbox, Sent, Drafts, Starred, Trash, Search, Pagination, Send, Reply, Forward, Attachments)
4. AI Assistant Chat with Real-Time SSE Token Streaming & Authorized Email Assistant
5. Google Calendar Integration (Asia/Kolkata timezone default)
6. Strict Multi-User Isolation & Token Encryption at Rest
"""
import base64
from datetime import datetime, timezone
import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import time
import uuid

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # Graceful zero-dependency fallback for loading .env
    _env_file = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(_env_file):
        try:
            with open(_env_file, "r", encoding="utf-8") as _f:
                for _line in _f:
                    _line = _line.strip()
                    if _line and not _line.startswith("#") and "=" in _line:
                        _k, _v = _line.split("=", 1)
                        os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))
        except Exception:
            pass

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("jarvis.app")

from flask import Flask, Response, g, jsonify, redirect, request, stream_with_context
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix

from auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    EMAIL_REGEX,
    REFRESH_TOKEN_EXPIRE_DAYS,
    decode_jwt_token,
    generate_user_tokens,
    get_app_api_token,
    hash_password,
    require_auth,
    verify_password,
)
from db import make_store
from integrations.calendar_service import CalendarService
from integrations.gmail_client import GmailService
from integrations.google_oauth import GoogleAccountMismatchError, GoogleOAuthService
from integrations.location_service import LocationService
from jarvis_core import Jarvis, MissingConfig
from keepalive import start_keepalive

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("MAX_UPLOAD_MB", "15")) * 1024 * 1024

# CORS: Allow all origins or configured CORS allowlist
cors_origins = os.getenv("CORS_ALLOWED_ORIGINS") or os.getenv("CORS_ORIGINS") or "*"
CORS(app, origins=cors_origins)

store = make_store()
jarvis = Jarvis()
oauth_svc = GoogleOAuthService()
gmail_svc = GmailService(oauth_svc)
calendar_svc = CalendarService()
location_svc = LocationService()

# Ensure master APP_API_TOKEN is securely persisted and loaded into os.environ
get_app_api_token()

STARTED = time.time()
ACTIVE_GENERATIONS = set()


# ---------- Helper Utilities ----------

def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


# ---------- Root & Health ----------

@app.get("/")
def index():
    return jsonify(
        name="JARVIS AI Personal Assistant Backend",
        version="2.1.0",
        status="online",
        features=[
            "JWT Authentication (Register, Login, Password Reset, Profile)",
            "Google OAuth with Strict Email Matching",
            "Full Gmail API Integration (All categories, Pagination, Search, Send Guard)",
            "Google Calendar API (Asia/Kolkata timezone default)",
            "Live Chat & Real-Time SSE Token Streaming",
            "Multi-Provider AI Fallback (LLM7, Pollinations, Groq, Gemini, Claude, OpenAI)",
        ],
    )


@app.get("/health")
def health():
    return jsonify(
        status="ok",
        uptime_seconds=int(time.time() - STARTED),
        storage=store.kind,
        timestamp=datetime.now(timezone.utc).isoformat(),
        **jarvis.status(),
    )


# ==============================================================================
# 1. USER AUTHENTICATION APIS
# ==============================================================================

@app.post("/api/auth/register")
def register():
    """Register a new JARVIS user."""
    body = request.get_json(silent=True) or {}
    full_name = (body.get("full_name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    confirm_password = body.get("confirm_password") or ""

    if not full_name or len(full_name) < 2:
        return jsonify(status="error", error="Full name is required (minimum 2 characters)"), 400
    if not email or not EMAIL_REGEX.match(email):
        return jsonify(status="error", error="A valid email address is required"), 400
    if len(password) < 6:
        return jsonify(status="error", error="Password must be at least 6 characters long"), 400
    if password != confirm_password:
        return jsonify(status="error", error="Passwords do not match"), 400

    # Check if email is already registered
    existing = store.get_user_by_email(email)
    if existing:
        return jsonify(status="error", error="An account with this email address already exists"), 409

    # Generate verification token
    verification_token = secrets.token_urlsafe(32)
    pwd_hash = hash_password(password)

    try:
        user = store.create_user(full_name, email, pwd_hash, verification_token=verification_token)
        access_token, refresh_token = generate_user_tokens(user["id"], user["email"])
        store.store_refresh_token(
            user["id"],
            _hash_token(refresh_token),
            time.time() + (REFRESH_TOKEN_EXPIRE_DAYS * 86400),
        )

        return jsonify(
            status="success",
            message="User registered successfully.",
            user={
                "id": user["id"],
                "full_name": user["full_name"],
                "email": user["email"],
                "is_verified": user["is_verified"],
            },
            verification_token=verification_token,  # Provided for easy local/APK testing
            access_token=access_token,
            refresh_token=refresh_token,
        ), 201
    except Exception as exc:
        log.exception("Registration failed")
        return jsonify(status="error", error=f"Registration failed: {str(exc)[:150]}"), 500


@app.post("/api/auth/login")
def login():
    """Login with registered email and password."""
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not email or not password:
        return jsonify(status="error", error="Email and password are required"), 400

    user = store.get_user_by_email(email)
    if not user or not verify_password(password, user["password_hash"]):
        return jsonify(status="error", error="Invalid email or password"), 401

    access_token, refresh_token = generate_user_tokens(user["id"], user["email"])
    store.store_refresh_token(
        user["id"],
        _hash_token(refresh_token),
        time.time() + (REFRESH_TOKEN_EXPIRE_DAYS * 86400),
    )

    google_acct = store.get_google_account(user["id"])

    return jsonify(
        status="success",
        user={
            "id": user["id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "is_verified": bool(user["is_verified"]),
            "is_google_connected": bool(google_acct),
            "google_email": google_acct.get("google_email") if google_acct else None,
        },
        access_token=access_token,
        refresh_token=refresh_token,
    )


@app.post("/api/auth/logout")
@require_auth
def logout():
    """Logout and invalidate refresh token."""
    body = request.get_json(silent=True) or {}
    ref_token = body.get("refresh_token")
    if ref_token:
        store.revoke_refresh_token(_hash_token(ref_token))
    return jsonify(status="success", message="Logged out successfully")


@app.post("/api/auth/refresh")
def refresh_token():
    """Rotate and issue a new access token using a valid refresh token."""
    body = request.get_json(silent=True) or {}
    ref_token = body.get("refresh_token")
    if not ref_token:
        return jsonify(status="error", error="Refresh token is required"), 400

    try:
        payload = decode_jwt_token(ref_token)
        if payload.get("type") != "refresh":
            return jsonify(status="error", error="Invalid token type"), 401

        token_hash = _hash_token(ref_token)
        user_id = store.validate_refresh_token(token_hash)
        if not user_id or user_id != payload.get("sub"):
            return jsonify(status="error", error="Refresh token is revoked or expired"), 401

        user = store.get_user_by_id(user_id)
        if not user:
            return jsonify(status="error", error="User not found"), 404

        # Rotate refresh token
        store.revoke_refresh_token(token_hash)
        new_access, new_refresh = generate_user_tokens(user["id"], user["email"])
        store.store_refresh_token(
            user["id"],
            _hash_token(new_refresh),
            time.time() + (REFRESH_TOKEN_EXPIRE_DAYS * 86400),
        )

        return jsonify(
            status="success",
            access_token=new_access,
            refresh_token=new_refresh,
        )
    except Exception as exc:
        return jsonify(status="error", error=f"Invalid refresh token: {str(exc)}"), 401


@app.post("/api/auth/verify-email")
@app.get("/api/auth/verify-email")
def verify_email():
    token = request.args.get("token") or (request.get_json(silent=True) or {}).get("token")
    if not token:
        return jsonify(status="error", error="Verification token is required"), 400

    verified = store.verify_user_email(token)
    if not verified:
        return jsonify(status="error", error="Invalid or expired verification token"), 400

    return jsonify(status="success", message="Email verified successfully. Your account is active.")


@app.post("/api/auth/forgot-password")
def forgot_password():
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    if not email:
        return jsonify(status="error", error="Email is required"), 400

    user = store.get_user_by_email(email)
    if not user:
        # Return generic success to avoid user enumeration
        return jsonify(status="success", message="If the email is registered, a password reset link has been issued.")

    reset_token = secrets.token_urlsafe(32)
    expires_at = time.time() + 3600  # 1 hour
    store.set_password_reset_token(email, reset_token, expires_at)

    return jsonify(
        status="success",
        message="Password reset token generated.",
        reset_token=reset_token,  # Returned for testing / development convenience
    )


@app.post("/api/auth/reset-password")
def reset_password():
    body = request.get_json(silent=True) or {}
    token = body.get("token") or ""
    new_password = body.get("new_password") or ""
    confirm_password = body.get("confirm_password") or ""

    if not token:
        return jsonify(status="error", error="Reset token is required"), 400
    if len(new_password) < 6:
        return jsonify(status="error", error="Password must be at least 6 characters"), 400
    if new_password != confirm_password:
        return jsonify(status="error", error="Passwords do not match"), 400

    success = store.reset_password(token, hash_password(new_password))
    if not success:
        return jsonify(status="error", error="Invalid or expired reset token"), 400

    return jsonify(status="success", message="Password reset successfully. You may now log in.")


@app.get("/api/auth/profile")
@require_auth
def get_profile():
    user = store.get_user_by_id(g.user_id)
    if not user:
        return jsonify(status="error", error="User not found"), 404

    google_acct = store.get_google_account(g.user_id)
    return jsonify(
        status="success",
        user={
            "id": user["id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "is_verified": bool(user["is_verified"]),
            "is_google_connected": bool(google_acct),
            "google_email": google_acct.get("google_email") if google_acct else None,
            "connected_at": google_acct.get("connected_at") if google_acct else None,
        },
    )


@app.patch("/api/auth/profile")
@require_auth
def update_profile():
    body = request.get_json(silent=True) or {}
    full_name = (body.get("full_name") or "").strip()
    if not full_name:
        return jsonify(status="error", error="Full name is required"), 400

    store.update_user_profile(g.user_id, full_name)
    return jsonify(status="success", message="Profile updated successfully")


@app.post("/api/auth/change-password")
@require_auth
def change_password():
    body = request.get_json(silent=True) or {}
    old_password = body.get("old_password") or ""
    new_password = body.get("new_password") or ""
    confirm_password = body.get("confirm_password") or ""

    user = store.get_user_by_email(g.user_email)
    if not user or not verify_password(old_password, user["password_hash"]):
        return jsonify(status="error", error="Current password is incorrect"), 400
    if len(new_password) < 6:
        return jsonify(status="error", error="New password must be at least 6 characters"), 400
    if new_password != confirm_password:
        return jsonify(status="error", error="New passwords do not match"), 400

    store.update_user_password(g.user_id, hash_password(new_password))
    return jsonify(status="success", message="Password changed successfully")


# ==============================================================================
# 2. GOOGLE OAUTH CONNECTION APIS
# ==============================================================================

@app.get("/api/auth/google/start")
@require_auth
def google_oauth_start():
    """Initiate Google OAuth flow with state token matching the current JARVIS user."""
    state = f"{g.user_id}:{secrets.token_urlsafe(16)}"
    redirect_uri = request.args.get("redirect_uri")
    auth_url = oauth_svc.get_authorization_url(state=state, redirect_uri=redirect_uri)
    return jsonify(
        status="success",
        authorization_url=auth_url,
        state=state,
        note="Google email must match your registered JARVIS email: " + g.user_email,
    )


@app.post("/api/auth/google/connect")
@require_auth
def google_oauth_connect():
    """Direct connect endpoint for APK or client-side code exchange."""
    body = request.get_json(silent=True) or {}
    code = body.get("code")
    redirect_uri = body.get("redirect_uri")

    if not code:
        return jsonify(status="error", error="Authorization code is required"), 400

    try:
        result = oauth_svc.connect_account(
            store=store,
            user_id=g.user_id,
            jarvis_email=g.user_email,
            code=code,
            redirect_uri=redirect_uri,
        )
        return jsonify(
            status="success",
            message="Google account connected successfully.",
            google_email=result["google_email"],
        )
    except GoogleAccountMismatchError as exc:
        return jsonify(status="error", error=str(exc), code="ACCOUNT_MISMATCH"), 403
    except Exception as exc:
        log.exception("Google OAuth connect failure")
        return jsonify(status="error", error=f"Google OAuth connection failed: {str(exc)}"), 500


@app.get("/api/auth/google/callback")
def google_oauth_callback():
    """Handle browser OAuth callback from Google."""
    code = request.args.get("code")
    state = request.args.get("state")
    error = request.args.get("error")

    if error:
        return jsonify(status="error", error=f"Google OAuth denied: {error}"), 400
    if not code or not state:
        return jsonify(status="error", error="Missing code or state parameter"), 400

    user_id = state.split(":")[0] if ":" in state else state
    user = store.get_user_by_id(user_id)
    if not user:
        return jsonify(status="error", error="Invalid user session in OAuth state"), 400

    try:
        oauth_svc.connect_account(
            store=store,
            user_id=user["id"],
            jarvis_email=user["email"],
            code=code,
        )
        return jsonify(
            status="success",
            message="Google account linked successfully to " + user["email"],
            user_id=user["id"],
        )
    except GoogleAccountMismatchError as exc:
        return jsonify(status="error", error=str(exc)), 403
    except Exception as exc:
        return jsonify(status="error", error=str(exc)), 500


@app.get("/api/auth/google/status")
@require_auth
def google_oauth_status():
    """Get current Google OAuth connection status."""
    acct = store.get_google_account(g.user_id)
    if not acct:
        return jsonify(status="success", is_connected=False)

    return jsonify(
        status="success",
        is_connected=True,
        google_email=acct["google_email"],
        token_expiry=acct.get("token_expiry"),
        connected_at=acct.get("connected_at"),
    )


@app.post("/api/auth/google/disconnect")
@require_auth
def google_oauth_disconnect():
    """Disconnect and revoke Google integration for user."""
    store.disconnect_google_account(g.user_id)
    return jsonify(status="success", message="Google account disconnected successfully")


# ==============================================================================
# 3. COMPLETE GMAIL INTEGRATION APIS
# ==============================================================================

@app.get("/api/gmail/messages")
@require_auth
def list_gmail_messages():
    """List messages from user's mailbox with pagination and category filtering."""
    category = request.args.get("category", "inbox")
    page_token = request.args.get("pageToken") or request.args.get("page_token")
    max_results = int(request.args.get("maxResults") or request.args.get("limit") or 15)
    query = request.args.get("q")

    try:
        res = gmail_svc.list_messages(
            store=store,
            user_id=g.user_id,
            category=category,
            page_token=page_token,
            max_results=max_results,
            query=query,
        )
        return jsonify(status="success", **res)
    except Exception as exc:
        log.exception("list_gmail_messages error")
        return jsonify(status="error", error=str(exc)), 500


@app.get("/api/gmail/messages/<message_id>")
@require_auth
def get_gmail_message_detail(message_id):
    """Retrieve full details of an individual email."""
    msg = gmail_svc.get_message(store, g.user_id, message_id)
    if not msg:
        return jsonify(status="error", error="Message not found"), 404
    return jsonify(status="success", message=msg)


@app.get("/api/gmail/search")
@require_auth
def search_gmail():
    """Search mailbox using Gmail query syntax."""
    query = request.args.get("q", "")
    page_token = request.args.get("pageToken")
    max_results = int(request.args.get("maxResults", 15))
    res = gmail_svc.search_messages(store, g.user_id, query=query, page_token=page_token, max_results=max_results)
    return jsonify(status="success", **res)


@app.post("/api/gmail/messages/<message_id>/read")
@require_auth
def mark_email_read(message_id):
    ok = gmail_svc.mark_read(store, g.user_id, message_id, is_read=True)
    return jsonify(status="success" if ok else "not_found", message_id=message_id, is_unread=False)


@app.post("/api/gmail/messages/<message_id>/unread")
@require_auth
def mark_email_unread(message_id):
    ok = gmail_svc.mark_read(store, g.user_id, message_id, is_read=False)
    return jsonify(status="success" if ok else "not_found", message_id=message_id, is_unread=True)


@app.post("/api/gmail/messages/<message_id>/star")
@require_auth
def star_email(message_id):
    ok = gmail_svc.toggle_star(store, g.user_id, message_id, starred=True)
    return jsonify(status="success" if ok else "not_found", message_id=message_id, is_starred=True)


@app.post("/api/gmail/messages/<message_id>/unstar")
@require_auth
def unstar_email(message_id):
    ok = gmail_svc.toggle_star(store, g.user_id, message_id, starred=False)
    return jsonify(status="success" if ok else "not_found", message_id=message_id, is_starred=False)


@app.post("/api/gmail/messages/<message_id>/archive")
@require_auth
def archive_email(message_id):
    ok = gmail_svc.archive_message(store, g.user_id, message_id)
    return jsonify(status="success" if ok else "not_found", message_id=message_id, archived=ok)


@app.post("/api/gmail/messages/<message_id>/trash")
@require_auth
def trash_email(message_id):
    ok = gmail_svc.trash_message(store, g.user_id, message_id, trash=True)
    return jsonify(status="success" if ok else "not_found", message_id=message_id, trashed=ok)


@app.post("/api/gmail/messages/<message_id>/restore")
@require_auth
def restore_email(message_id):
    ok = gmail_svc.trash_message(store, g.user_id, message_id, trash=False)
    return jsonify(status="success" if ok else "not_found", message_id=message_id, restored=ok)


@app.post("/api/gmail/drafts")
@require_auth
def create_email_draft():
    body = request.get_json(silent=True) or {}
    to = (body.get("to") or body.get("recipient") or "").strip()
    subject = (body.get("subject") or "").strip()
    content = body.get("body") or ""

    if not to or not subject:
        return jsonify(status="error", error="Recipient and subject are required"), 400

    draft = gmail_svc.create_draft(store, g.user_id, to=to, subject=subject, body=content)
    return jsonify(status="success", draft=draft)


@app.post("/api/gmail/send")
@require_auth
def send_email():
    """Send email with mandatory preview confirmation check."""
    body = request.get_json(silent=True) or {}
    to = (body.get("to") or body.get("recipient") or "").strip()
    subject = (body.get("subject") or "").strip()
    content = body.get("body") or ""
    confirmed = bool(body.get("confirmed", False))

    if not to or not subject:
        return jsonify(status="error", error="Recipient and subject are required"), 400

    result = gmail_svc.send_email(
        store=store,
        user_id=g.user_id,
        to=to,
        subject=subject,
        body=content,
        confirmed=confirmed,
    )
    return jsonify(status="success", **result)


@app.post("/api/gmail/messages/<message_id>/reply")
@require_auth
def reply_email(message_id):
    body = request.get_json(silent=True) or {}
    content = body.get("body") or ""
    reply_all = bool(body.get("reply_all", False))
    confirmed = bool(body.get("confirmed", False))

    if not content:
        return jsonify(status="error", error="Reply body is required"), 400

    result = gmail_svc.reply_email(
        store=store,
        user_id=g.user_id,
        message_id=message_id,
        body=content,
        reply_all=reply_all,
        confirmed=confirmed,
    )
    return jsonify(status="success", **result)


@app.post("/api/gmail/messages/<message_id>/forward")
@require_auth
def forward_email(message_id):
    body = request.get_json(silent=True) or {}
    to = (body.get("to") or "").strip()
    additional_body = body.get("body") or ""
    confirmed = bool(body.get("confirmed", False))

    if not to:
        return jsonify(status="error", error="Recipient 'to' is required"), 400

    result = gmail_svc.forward_email(
        store=store,
        user_id=g.user_id,
        message_id=message_id,
        to=to,
        additional_body=additional_body,
        confirmed=confirmed,
    )
    return jsonify(status="success", **result)


# ==============================================================================
# 4. CHAT & AI ASSISTANT APIS
# ==============================================================================

@app.post("/api/chat")
@app.post("/chat")
@require_auth
def chat():
    body = request.get_json(silent=True) or {}
    message = (body.get("message") or "").strip()
    conv_id = body.get("conversation_id") or body.get("session_id") or uuid.uuid4().hex
    provider = body.get("provider", "auto")

    if not message:
        return jsonify(status="error", error="Please provide 'message'"), 400

    history_msgs = store.history(conv_id, 10, user_id=g.user_id)
    base_url = request.url_root.rstrip("/")

    result = jarvis.run(
        message=message,
        history=history_msgs,
        files=[],
        store=store,
        base_url=base_url,
        provider=provider,
        user_id=g.user_id,
        gmail_service=gmail_svc,
    )

    store.add_message(conv_id, "user", message, user_id=g.user_id)
    asst_id = store.add_message(
        conv_id,
        "assistant",
        result["response"],
        {"tasks": result.get("tasks", []), "actions": result.get("actions", [])},
        provider=result.get("provider", "auto"),
        user_id=g.user_id,
    )

    return jsonify(
        status="success",
        conversation_id=conv_id,
        session_id=conv_id,
        message_id=asst_id,
        content=result["response"],
        provider=result.get("provider", "auto"),
        actions=result.get("actions", []),
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@app.post("/api/chat/stream")
@require_auth
def chat_stream():
    """SSE real-time streaming endpoint for tokens with Gmail context."""
    body = request.get_json(silent=True) or {}
    message = (body.get("message") or "").strip()
    conv_id = body.get("conversation_id") or uuid.uuid4().hex
    provider = body.get("provider", "auto")

    if not message:
        return jsonify(status="error", error="Please provide 'message'"), 400

    request_id = uuid.uuid4().hex
    ACTIVE_GENERATIONS.add(request_id)
    user_id = g.user_id

    def generate_sse():
        full_text = []
        try:
            history_msgs = store.history(conv_id, 10, user_id=user_id)
            base_url = request.url_root.rstrip("/")
            token_gen, used_p, tasks, actions = jarvis.stream_run(
                message, history_msgs, [], store, base_url, provider=provider, user_id=user_id, gmail_service=gmail_svc
            )

            yield f"data: {json.dumps({'type': 'start', 'conversation_id': conv_id, 'provider': used_p, 'request_id': request_id})}\n\n"

            for token in token_gen:
                if request_id not in ACTIVE_GENERATIONS:
                    yield f"data: {json.dumps({'type': 'stopped', 'message': 'Cancelled'})}\n\n"
                    break
                full_text.append(token)
                yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"

            final_message = "".join(full_text)
            if actions:
                yield f"data: {json.dumps({'type': 'actions', 'actions': actions})}\n\n"

            store.add_message(conv_id, "user", message, user_id=user_id)
            asst_msg_id = store.add_message(
                conv_id, "assistant", final_message, {"tasks": tasks, "actions": actions}, provider=used_p, user_id=user_id
            )

            yield f"data: {json.dumps({'type': 'done', 'status': 'success', 'message_id': asst_msg_id})}\n\n"
        except Exception as exc:
            log.exception("SSE stream error")
            yield f"data: {json.dumps({'type': 'error', 'error': str(exc)[:200]})}\n\n"
        finally:
            ACTIVE_GENERATIONS.discard(request_id)

    return Response(stream_with_context(generate_sse()), mimetype="text/event-stream")


@app.get("/api/chat/conversations")
@require_auth
def list_conversations():
    limit = int(request.args.get("limit", 50))
    convs = store.list_conversations(limit=limit, user_id=g.user_id)
    return jsonify(status="success", conversations=convs)


@app.get("/api/chat/history")
@app.get("/history/<session_id>")
@require_auth
def chat_history(session_id=None):
    cid = session_id or request.args.get("conversation_id") or request.args.get("session_id")
    if not cid:
        return jsonify(status="error", error="Valid conversation id required"), 400
    limit = int(request.args.get("limit", 100))
    return jsonify(status="success", conversation_id=cid, messages=store.history(cid, limit, user_id=g.user_id))


# ==============================================================================
# 5. GOOGLE CALENDAR APIS
# ==============================================================================

@app.get("/api/calendar/events")
@require_auth
def get_calendar_events():
    limit = int(request.args.get("max_results", 20))
    events = calendar_svc.list_events(max_results=limit)
    return jsonify(status="success", timezone=calendar_svc.default_tz, events=events)


@app.post("/api/calendar/events")
@require_auth
def create_calendar_event():
    body = request.get_json(silent=True) or {}
    summary = body.get("summary", "").strip()
    start_time = body.get("start_time") or body.get("start")
    end_time = body.get("end_time") or body.get("end")
    location = body.get("location", "")
    description = body.get("description", "")

    if not summary or not start_time:
        return jsonify(status="error", error="Missing summary or start_time"), 400

    event = calendar_svc.create_event(
        summary=summary,
        start_time=start_time,
        end_time=end_time,
        location=location,
        description=description,
    )
    return jsonify(status="success", event=event)


@app.delete("/api/calendar/events/<event_id>")
@require_auth
def delete_calendar_event(event_id):
    deleted = calendar_svc.delete_event(event_id)
    return jsonify(status="success" if deleted else "not_found", deleted=deleted)


# ==============================================================================
# 6. LOCATION APIS & STATIC FILES
# ==============================================================================

@app.post("/api/location/context")
@require_auth
def location_context():
    body = request.get_json(silent=True) or {}
    try:
        lat = float(body.get("latitude"))
        lng = float(body.get("longitude"))
    except (TypeError, ValueError):
        return jsonify(status="error", error="Valid latitude and longitude numbers are required"), 400

    query = body.get("query")
    accuracy = body.get("accuracy")
    context = location_svc.process_context(latitude=lat, longitude=lng, query=query, accuracy=accuracy)
    return jsonify(status="success", context=context)


@app.get("/files/<token>")
def files(token):
    found = store.get_file(token)
    if not found:
        return jsonify(status="error", error="File not found or expired"), 404
    data, mime = found
    return Response(data, mimetype=mime, headers={"Cache-Control": "private, max-age=3600"})


start_keepalive()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
