"""Production-Grade Flask Application for JARVIS AI Assistant.

Upgrades:
- SSE streaming chat (/api/chat/stream)
- Standard live chat (/api/chat) with multi-provider routing and fallback
- Conversation management (/api/chat/conversations, /api/chat/history)
- Stop generation endpoint (/api/chat/stop)
- Google Calendar endpoints (/api/calendar/events)
- Gmail endpoints (/api/email/messages, /api/email/draft, /api/email/send)
- Location context (/api/location/context)
- Full backward compatibility for /chat and /history/<session_id>
"""
import base64
from datetime import datetime, timezone
from functools import wraps
import hmac
import json
import logging
import os
import re
import time
import uuid

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request, stream_with_context
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("jarvis.app")

from db import make_store  # noqa: E402
from integrations.calendar_service import CalendarService  # noqa: E402
from integrations.email_service import EmailService  # noqa: E402
from integrations.location_service import LocationService  # noqa: E402
from jarvis_core import Jarvis, MissingConfig  # noqa: E402
from keepalive import start_keepalive  # noqa: E402

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("MAX_UPLOAD_MB", "15")) * 1024 * 1024

# CORS
cors_origins = os.getenv("CORS_ALLOWED_ORIGINS") or os.getenv("CORS_ORIGINS") or "*"
CORS(app, origins=cors_origins)

store = make_store()
jarvis = Jarvis()
calendar_svc = CalendarService()
email_svc = EmailService()
location_svc = LocationService()

STARTED = time.time()
SESSION_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
MAX_FILES = 4

# Active stream cancellation registry
ACTIVE_GENERATIONS = set()

try:
    store.cleanup(int(os.getenv("FILE_TTL_DAYS", "7")))
except Exception as exc:
    log.warning("File store cleanup skipped: %s", exc)


def require_token(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        expected = os.getenv("APP_API_TOKEN", "").strip()
        if not expected:
            # If ALLOW_NO_AUTH is enabled, skip check
            if os.getenv("ALLOW_NO_AUTH", "").lower() in ("1", "true", "yes"):
                return fn(*args, **kwargs)
            return jsonify(status="error", error="Server is missing APP_API_TOKEN configuration"), 503

        given = request.headers.get("X-API-Token", "")
        auth = request.headers.get("Authorization", "")
        if not given and auth.lower().startswith("bearer "):
            given = auth[7:]

        if not hmac.compare_digest(given.encode(), expected.encode()):
            return jsonify(status="error", error="Invalid or missing authentication token"), 401
        return fn(*args, **kwargs)

    return wrapper


def _extract_access_token() -> str:
    """Extract optional Google OAuth bearer token for Calendar or Gmail."""
    google_token = request.headers.get("X-Google-Access-Token", "")
    if google_token:
        return google_token
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer ") and not os.getenv("APP_API_TOKEN"):
        return auth[7:]
    return ""


@app.get("/")
def index():
    return jsonify(
        name="JARVIS AI Assistant Backend",
        version="2.0.0",
        status="online",
        documentation={
            "chat": "POST /api/chat or POST /chat",
            "chat_stream": "POST /api/chat/stream",
            "conversations": "GET /api/chat/conversations",
            "history": "GET /api/chat/history or GET /history/<session_id>",
            "calendar": "GET /api/calendar/events",
            "email": "GET /api/email/messages",
            "location": "POST /api/location/context",
            "health": "GET /health",
        },
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


@app.get("/api/providers")
@require_token
def get_providers():
    return jsonify(
        status="success",
        providers=jarvis.router.get_statuses(),
        order=jarvis.router.get_provider_order(),
    )


def _read_files():
    files = []
    if (request.content_type or "").startswith("multipart/"):
        message = (request.form.get("message") or "").strip()
        conv_id = request.form.get("conversation_id") or request.form.get("session_id") or ""
        provider = request.form.get("provider", "auto")
        for f in request.files.getlist("files")[:MAX_FILES]:
            files.append({"name": f.filename or "file", "mime": f.mimetype or "application/octet-stream", "data": f.read()})
    else:
        body = request.get_json(silent=True) or {}
        message = (body.get("message") or "").strip()
        conv_id = body.get("conversation_id") or body.get("session_id") or ""
        provider = body.get("provider", "auto")
        for f in (body.get("files") or [])[:MAX_FILES]:
            try:
                raw = str(f.get("data", ""))
                data = base64.b64decode(raw.split(",")[-1], validate=False)
            except Exception:
                raise ValueError("A file has invalid base64 data")
            files.append({"name": f.get("name") or "file", "mime": f.get("mime") or "application/octet-stream", "data": data})
    return message, conv_id, provider, files


# ---------- CHAT ENDPOINTS ----------

@app.post("/api/chat")
@app.post("/chat")
@require_token
def chat():
    try:
        message, conv_id, provider, files = _read_files()
    except ValueError as exc:
        return jsonify(status="error", error=str(exc)), 400

    if not message and not files:
        return jsonify(status="error", error="Please provide 'message' or at least one file"), 400
    if not message:
        message = "Please analyze the attached file(s)."

    if not conv_id or not SESSION_RE.match(conv_id):
        conv_id = uuid.uuid4().hex

    try:
        history_msgs = store.history(conv_id, 10)
        base_url = request.url_root.rstrip("/")
        result = jarvis.run(message, history_msgs, files, store, base_url, provider=provider)

        user_msg_id = store.add_message(conv_id, "user", message, {"files": [f["name"] for f in files]})
        asst_msg_id = store.add_message(
            conv_id,
            "assistant",
            result["response"],
            {"tasks": result.get("tasks", []), "actions": result.get("actions", [])},
            provider=result.get("provider", "auto"),
        )
    except MissingConfig as exc:
        return jsonify(status="error", error=str(exc)), 503
    except Exception as exc:
        log.exception("Chat execution error")
        return jsonify(status="error", error=f"Assistant processing failed: {str(exc)[:200]}"), 500

    return jsonify(
        status="success",
        conversation_id=conv_id,
        session_id=conv_id,
        message_id=asst_msg_id,
        user_message_id=user_msg_id,
        content=result["response"],
        response=result["response"],
        provider=result.get("provider", "auto"),
        actions=result.get("actions", []),
        tasks=result.get("tasks", []),
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@app.post("/api/chat/stream")
@require_token
def chat_stream():
    """SSE streaming endpoint for low-latency live token streaming."""
    try:
        message, conv_id, provider, files = _read_files()
    except ValueError as exc:
        return jsonify(status="error", error=str(exc)), 400

    if not message and not files:
        return jsonify(status="error", error="Please provide 'message' or at least one file"), 400
    if not message:
        message = "Please analyze the attached file(s)."

    if not conv_id or not SESSION_RE.match(conv_id):
        conv_id = uuid.uuid4().hex

    request_id = uuid.uuid4().hex
    ACTIVE_GENERATIONS.add(request_id)

    def generate_sse():
        full_text = []
        try:
            history_msgs = store.history(conv_id, 10)
            base_url = request.url_root.rstrip("/")
            token_gen, used_p, tasks, actions = jarvis.stream_run(
                message, history_msgs, files, store, base_url, provider=provider
            )

            # 1. Start event
            yield f"data: {json.dumps({'type': 'start', 'conversation_id': conv_id, 'provider': used_p, 'request_id': request_id})}\n\n"

            # 2. Token chunks
            for token in token_gen:
                if request_id not in ACTIVE_GENERATIONS:
                    yield f"data: {json.dumps({'type': 'stopped', 'message': 'Generation cancelled by user'})}\n\n"
                    break
                full_text.append(token)
                yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"

            final_message = "".join(full_text)

            # 3. Actions event if any
            if actions:
                yield f"data: {json.dumps({'type': 'actions', 'actions': actions})}\n\n"

            # Store messages
            store.add_message(conv_id, "user", message, {"files": [f["name"] for f in files]})
            asst_msg_id = store.add_message(
                conv_id, "assistant", final_message, {"tasks": tasks, "actions": actions}, provider=used_p
            )

            # 4. Completion event
            yield f"data: {json.dumps({'type': 'done', 'status': 'success', 'message_id': asst_msg_id, 'provider': used_p, 'timestamp': datetime.now(timezone.utc).isoformat()})}\n\n"
        except Exception as exc:
            log.exception("SSE stream failure")
            yield f"data: {json.dumps({'type': 'error', 'error': str(exc)[:200]})}\n\n"
        finally:
            ACTIVE_GENERATIONS.discard(request_id)

    return Response(stream_with_context(generate_sse()), mimetype="text/event-stream")


@app.post("/api/chat/stop")
@require_token
def stop_generation():
    body = request.get_json(silent=True) or {}
    req_id = body.get("request_id")
    if req_id and req_id in ACTIVE_GENERATIONS:
        ACTIVE_GENERATIONS.discard(req_id)
        return jsonify(status="success", message=f"Stopped generation {req_id}")
    ACTIVE_GENERATIONS.clear()
    return jsonify(status="success", message="All active generations stopped")


@app.get("/api/chat/conversations")
@require_token
def list_conversations():
    limit = int(request.args.get("limit", 50))
    convs = store.list_conversations(limit)
    return jsonify(status="success", conversations=convs)


@app.delete("/api/chat/conversations/<conversation_id>")
@require_token
def delete_conversation(conversation_id):
    if not SESSION_RE.match(conversation_id):
        return jsonify(status="error", error="Invalid conversation id"), 400
    deleted = store.delete_conversation(conversation_id)
    return jsonify(status="success" if deleted else "not_found", deleted=deleted)


@app.get("/api/chat/history")
@app.get("/history/<session_id>")
@require_token
def chat_history(session_id=None):
    cid = session_id or request.args.get("conversation_id") or request.args.get("session_id")
    if not cid or not SESSION_RE.match(cid):
        return jsonify(status="error", error="Valid conversation id required"), 400
    limit = int(request.args.get("limit", 100))
    return jsonify(status="success", conversation_id=cid, session_id=cid, messages=store.history(cid, limit))


# ---------- GOOGLE CALENDAR ENDPOINTS ----------

@app.get("/api/calendar/events")
@require_token
def get_calendar_events():
    access_token = _extract_access_token()
    limit = int(request.args.get("max_results", 20))
    events = calendar_svc.list_events(access_token=access_token, max_results=limit)
    return jsonify(status="success", timezone=calendar_svc.default_tz, events=events)


@app.post("/api/calendar/events")
@require_token
def create_calendar_event():
    body = request.get_json(silent=True) or {}
    summary = body.get("summary", "").strip()
    start_time = body.get("start_time") or body.get("start")
    end_time = body.get("end_time") or body.get("end")
    location = body.get("location", "")
    description = body.get("description", "")

    if not summary or not start_time:
        return jsonify(status="error", error="Missing summary or start_time"), 400

    access_token = _extract_access_token()
    event = calendar_svc.create_event(
        summary=summary,
        start_time=start_time,
        end_time=end_time,
        location=location,
        description=description,
        access_token=access_token,
    )
    return jsonify(status="success", event=event)


@app.delete("/api/calendar/events/<event_id>")
@require_token
def delete_calendar_event(event_id):
    access_token = _extract_access_token()
    deleted = calendar_svc.delete_event(event_id, access_token=access_token)
    return jsonify(status="success" if deleted else "not_found", deleted=deleted)


# ---------- GMAIL INTEGRATION ENDPOINTS ----------

@app.get("/api/email/messages")
@require_token
def list_email_messages():
    access_token = _extract_access_token()
    query = request.args.get("q", "")
    limit = int(request.args.get("limit", 10))
    messages = email_svc.list_messages(query=query, access_token=access_token, max_results=limit)
    return jsonify(status="success", messages=messages)


@app.get("/api/email/messages/<message_id>")
@require_token
def get_email_message(message_id):
    access_token = _extract_access_token()
    msg = email_svc.get_message(message_id, access_token=access_token)
    if not msg:
        return jsonify(status="error", error="Message not found"), 404
    return jsonify(status="success", message=msg)


@app.post("/api/email/draft")
@require_token
def draft_email():
    body = request.get_json(silent=True) or {}
    to = body.get("to") or body.get("recipient", "")
    subject = body.get("subject", "")
    content = body.get("body", "")
    if not to or not subject:
        return jsonify(status="error", error="Missing recipient or subject"), 400

    draft = email_svc.draft_email(to, subject, content)
    return jsonify(status="success", draft=draft)


@app.post("/api/email/send")
@require_token
def send_email():
    body = request.get_json(silent=True) or {}
    to = body.get("to") or body.get("recipient", "")
    subject = body.get("subject", "")
    content = body.get("body", "")
    confirmed = bool(body.get("confirmed", False))

    if not to or not subject:
        return jsonify(status="error", error="Missing recipient or subject"), 400

    access_token = _extract_access_token()
    result = email_svc.send_email(to, subject, content, confirmed=confirmed, access_token=access_token)
    return jsonify(status="success", **result)


# ---------- LOCATION ENDPOINTS ----------

@app.post("/api/location/context")
@require_token
def location_context():
    body = request.get_json(silent=True) or {}
    try:
        lat = float(body.get("latitude"))
        lng = float(body.get("longitude"))
    except (TypeError, ValueError):
        return jsonify(status="error", error="Valid latitude and longitude numbers are required"), 400

    query = body.get("query")
    accuracy = body.get("accuracy")
    try:
        context = location_svc.process_context(latitude=lat, longitude=lng, query=query, accuracy=accuracy)
        return jsonify(status="success", context=context)
    except Exception as exc:
        return jsonify(status="error", error=str(exc)), 400


# ---------- FILE SERVING ----------

@app.get("/files/<token>")
def files(token):
    found = store.get_file(token)
    if not found:
        return jsonify(status="error", error="File not found or expired"), 404
    data, mime = found
    return Response(data, mimetype=mime, headers={"Cache-Control": "private, max-age=3600"})


@app.errorhandler(413)
def too_large(_):
    return jsonify(status="error", error=f"Upload too large (limit {os.getenv('MAX_UPLOAD_MB', '15')} MB)"), 413


start_keepalive()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
