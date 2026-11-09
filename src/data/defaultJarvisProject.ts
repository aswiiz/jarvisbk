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
    # Only synchronous chat, no SSE stream, no device actions, no provider selection
    return jsonify(response="Original chat response")
`,
  'JARVIS-main/jarvis_core.py': `# Original v1.0 jarvis_core.py
class Jarvis:
    def __init__(self):
        # Tied strictly to Hugging Face and single provider
        self.hf_token = os.getenv("HUGGINGFACE_ACCESS_TOKEN")
`,
  'JARVIS-main/db.py': `# Original v1.0 db.py
class MemoryStore:
    pass

class MongoStore:
    # Only MongoDB was supported, requiring external Mongo cluster
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
  'JARVIS-main/app.py': {
    path: 'JARVIS-main/app.py',
    name: 'app.py',
    size: 9200,
    originalContent: ORIGINAL_V1_FILES['JARVIS-main/app.py'],
    content: `"""Production-Grade Flask Application for JARVIS AI Assistant.

Upgrades in v2.0:
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

from db import make_store
from integrations.calendar_service import CalendarService
from integrations.email_service import EmailService
from integrations.location_service import LocationService
from jarvis_core import Jarvis, MissingConfig
from keepalive import start_keepalive

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("MAX_UPLOAD_MB", "15")) * 1024 * 1024

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
ACTIVE_GENERATIONS = set()


def require_token(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        expected = os.getenv("APP_API_TOKEN", "").strip()
        if not expected:
            if os.getenv("ALLOW_NO_AUTH", "").lower() in ("1", "true", "yes"):
                return fn(*args, **kwargs)
            return jsonify(status="error", error="Server missing APP_API_TOKEN"), 503

        given = request.headers.get("X-API-Token", "")
        auth = request.headers.get("Authorization", "")
        if not given and auth.lower().startswith("bearer "):
            given = auth[7:]

        if not hmac.compare_digest(given.encode(), expected.encode()):
            return jsonify(status="error", error="Invalid or missing authentication token"), 401
        return fn(*args, **kwargs)

    return wrapper


@app.get("/health")
def health():
    return jsonify(
        status="ok",
        uptime_seconds=int(time.time() - STARTED),
        storage=store.kind,
        timestamp=datetime.now(timezone.utc).isoformat(),
        **jarvis.status(),
    )


@app.post("/api/chat")
@app.post("/chat")
@require_token
def chat():
    body = request.get_json(silent=True) or {}
    message = (body.get("message") or "").strip()
    conv_id = body.get("conversation_id") or body.get("session_id") or uuid.uuid4().hex
    provider = body.get("provider", "auto")

    history_msgs = store.history(conv_id, 10)
    base_url = request.url_root.rstrip("/")
    result = jarvis.run(message, history_msgs, [], store, base_url, provider=provider)

    store.add_message(conv_id, "user", message)
    asst_id = store.add_message(conv_id, "assistant", result["response"], provider=result.get("provider", "auto"))

    return jsonify(
        status="success",
        conversation_id=conv_id,
        message_id=asst_id,
        content=result["response"],
        provider=result.get("provider", "auto"),
        actions=result.get("actions", []),
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@app.post("/api/chat/stream")
@require_token
def chat_stream():
    body = request.get_json(silent=True) or {}
    message = (body.get("message") or "").strip()
    conv_id = body.get("conversation_id") or uuid.uuid4().hex
    provider = body.get("provider", "auto")
    req_id = uuid.uuid4().hex
    ACTIVE_GENERATIONS.add(req_id)

    def generate_sse():
        try:
            history_msgs = store.history(conv_id, 10)
            base_url = request.url_root.rstrip("/")
            token_gen, used_p, tasks, actions = jarvis.stream_run(
                message, history_msgs, [], store, base_url, provider=provider
            )
            yield f"data: {json.dumps({'type': 'start', 'conversation_id': conv_id, 'provider': used_p, 'request_id': req_id})}\\n\\n"

            full = []
            for t in token_gen:
                if req_id not in ACTIVE_GENERATIONS:
                    break
                full.append(t)
                yield f"data: {json.dumps({'type': 'token', 'token': t})}\\n\\n"

            if actions:
                yield f"data: {json.dumps({'type': 'actions', 'actions': actions})}\\n\\n"

            yield f"data: {json.dumps({'type': 'done', 'status': 'success'})}\\n\\n"
        finally:
            ACTIVE_GENERATIONS.discard(req_id)

    return Response(stream_with_context(generate_sse()), mimetype="text/event-stream")


@app.get("/api/calendar/events")
@require_token
def get_calendar_events():
    events = calendar_svc.list_events()
    return jsonify(status="success", timezone=calendar_svc.default_tz, events=events)


@app.get("/api/email/messages")
@require_token
def list_email_messages():
    messages = email_svc.list_messages()
    return jsonify(status="success", messages=messages)


@app.post("/api/location/context")
@require_token
def location_context():
    body = request.get_json(silent=True) or {}
    lat, lng = float(body.get("latitude", 0)), float(body.get("longitude", 0))
    query = body.get("query")
    context = location_svc.process_context(lat, lng, query=query)
    return jsonify(status="success", context=context)


start_keepalive()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
`,
  },
  'JARVIS-main/providers.py': {
    path: 'JARVIS-main/providers.py',
    name: 'providers.py',
    size: 16400,
    content: `"""AI Provider Architecture for JARVIS.

Modular adapters with unified interface:
- llm7 (keyless free or custom key)
- pollinations (keyless anonymous AI endpoint)
- groq (Groq Cloud API)
- gemini (Google Gemini 2.5 Flash)
- openai (OpenAI GPT-4o mini)
- claude (Anthropic Claude 3.5 Sonnet)

Features automatic fallback with circuit-breaker cooldown.
"""
import json
import logging
import os
import re
import time
from typing import Any, Dict, Generator, List, Optional, Tuple
import requests

log = logging.getLogger("jarvis.providers")
DEFAULT_PROVIDER_ORDER = "llm7,pollinations,groq,gemini,openai,claude"


class BaseProvider:
    def __init__(self, name: str, model: str, api_key: str = "", base_url: str = ""):
        self.name = name
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.timeout = 45

    def validate_configuration(self) -> Tuple[bool, str]:
        return True, "Ready"

    def get_status(self) -> Dict[str, Any]:
        valid, msg = self.validate_configuration()
        return {
            "name": self.name,
            "model": self.model,
            "configured": valid,
            "message": msg,
            "has_key": bool(self.api_key),
        }

    def generate_response(self, messages: List[Dict[str, str]], temperature: float = 0.3) -> str:
        raise NotImplementedError


class LLM7Provider(BaseProvider):
    def __init__(self):
        super().__init__("llm7", "gpt-oss:20b", os.getenv("LLM7_API_KEY", ""), "https://api.llm7.io/v1")


class PollinationsProvider(BaseProvider):
    def __init__(self):
        super().__init__("pollinations", "openai", "", "https://text.pollinations.ai")

    def generate_response(self, messages: List[Dict[str, str]], temperature: float = 0.3) -> str:
        res = requests.post(f"{self.base_url}/openai", json={"model": self.model, "messages": messages, "temperature": temperature})
        return res.json()["choices"][0]["message"]["content"]


class ProviderRouter:
    def __init__(self):
        self._cooldown: Dict[str, float] = {}
        self.providers = self._init_providers()

    def _init_providers(self):
        return {
            "llm7": LLM7Provider(),
            "pollinations": PollinationsProvider(),
        }

    def get_provider_order(self) -> List[str]:
        raw = os.getenv("LLM_PROVIDER_ORDER", DEFAULT_PROVIDER_ORDER)
        return [p.strip() for p in raw.split(",") if p.strip()]
`,
  },
  'JARVIS-main/actions.py': {
    path: 'JARVIS-main/actions.py',
    name: 'actions.py',
    size: 3900,
    content: `"""Structured Assistant and Device Actions for JARVIS.

Interprets requests for Android device actions, alarms, timers, reminders, and system settings.
The backend outputs structured action instructions so the Android client can execute them locally.
"""
import re
from typing import Any, Dict, List


def extract_device_actions(user_message: str, assistant_response: str) -> List[Dict[str, Any]]:
    actions: List[Dict[str, Any]] = []
    msg = user_message.lower().strip()

    # 1. Timers
    timer_match = re.search(r'(?:set|start|create)?\\s*(?:a\\s+)?timer\\s+(?:for\\s+)?(\\d+)\\s*(min(?:ute)?s?|sec(?:ond)?s?|hours?|hrs?)', msg)
    if timer_match:
        val = int(timer_match.group(1))
        unit = timer_match.group(2)
        multiplier = 60
        if "sec" in unit:
            multiplier = 1
        elif "hour" in unit or "hr" in unit:
            multiplier = 3600
        actions.append({
            "type": "device_action",
            "action": "set_timer",
            "seconds": val * multiplier,
            "label": "JARVIS Timer",
            "requires_confirmation": False,
        })

    # 2. Alarms
    alarm_match = re.search(r'(?:set\\s+(?:an?\\s+)?alarm(?:\\s+for)?|wake\\s+me\\s+up\\s+at)\\s+(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?)', msg)
    if alarm_match:
        actions.append({
            "type": "device_action",
            "action": "set_alarm",
            "time": alarm_match.group(1).strip(),
            "label": "JARVIS Alarm",
            "requires_confirmation": False,
        })

    # 3. App Launching
    app_match = re.search(r'(?:open|launch|start)\\s+(?:the\\s+)?(camera|youtube|spotify|maps|calendar|settings|whatsapp|chrome|gmail)', msg)
    if app_match:
        actions.append({
            "type": "device_action",
            "action": "open_app",
            "app": app_match.group(1),
            "requires_confirmation": False,
        })

    return actions
`,
  },
  'JARVIS-main/db.py': {
    path: 'JARVIS-main/db.py',
    name: 'db.py',
    size: 12100,
    originalContent: ORIGINAL_V1_FILES['JARVIS-main/db.py'],
    content: `"""Multi-Engine Database Layer for JARVIS.

Supports:
1. SQLite (local zero-configuration persistence via SQLITE_PATH / jarvis.db)
2. PostgreSQL (production via DATABASE_URL)
3. MongoDB (compatibility when MONGODB_URI is provided)
4. MemoryStore (in-memory fallback)
"""
from collections import OrderedDict, defaultdict
import json
import logging
import os
import secrets
import sqlite3
import time
from typing import Any, Dict, List, Optional, Tuple

log = logging.getLogger("jarvis.db")


class SQLiteStore:
    kind = "sqlite"

    def __init__(self, db_path: str = "jarvis.db"):
        self.db_path = db_path
        self._init_db()

    def _get_conn(self):
        conn = sqlite3.connect(self.db_path, timeout=10)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    provider TEXT DEFAULT 'auto',
                    meta TEXT DEFAULT '{}',
                    ts REAL NOT NULL
                )
            """)
            conn.commit()

    def add_message(self, conversation_id: str, role: str, content: str, provider: str = "auto") -> str:
        msg_id = secrets.token_hex(8)
        now_ts = time.time()
        with self._get_conn() as conn:
            conn.execute("""
                INSERT INTO conversations (id, title, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at
            """, (conversation_id, content[:40], now_ts, now_ts))
            conn.execute("""
                INSERT INTO messages (id, conversation_id, role, content, provider, ts)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (msg_id, conversation_id, role, content, provider, now_ts))
            conn.commit()
        return msg_id

    def history(self, conversation_id: str, limit: int = 10):
        with self._get_conn() as conn:
            cur = conn.execute("SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY ts DESC LIMIT ?", (conversation_id, limit))
            return [{"role": r["role"], "content": r["content"]} for r in reversed(cur.fetchall())]

    def list_conversations(self, limit: int = 50):
        with self._get_conn() as conn:
            cur = conn.execute("SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ?", (limit,))
            return [dict(r) for r in cur.fetchall()]


def make_store():
    return SQLiteStore(os.getenv("SQLITE_PATH", "jarvis.db"))
`,
  },
  'JARVIS-main/integrations/calendar_service.py': {
    path: 'JARVIS-main/integrations/calendar_service.py',
    name: 'calendar_service.py',
    size: 7400,
    content: `"""Google Calendar Integration Service for JARVIS.

Supports list events, create event, conflict detection.
Default timezone: Asia/Kolkata
"""
from datetime import datetime, timedelta, timezone
import os
from typing import Any, Dict, List, Optional

DEFAULT_TIMEZONE = os.getenv("DEFAULT_TIMEZONE", "Asia/Kolkata")


class CalendarService:
    def __init__(self):
        self.default_tz = DEFAULT_TIMEZONE
        self._mock_events: List[Dict[str, Any]] = [
            {
                "id": "evt-101",
                "summary": "Project Review Meeting",
                "start": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
                "end": (datetime.now(timezone.utc) + timedelta(hours=3)).isoformat(),
                "location": "Main Conference Room",
                "description": "Weekly milestone review.",
            }
        ]

    def list_events(self, access_token: Optional[str] = None) -> List[Dict[str, Any]]:
        return self._mock_events

    def create_event(self, summary: str, start_time: str, end_time: Optional[str] = None) -> Dict[str, Any]:
        evt = {
            "id": f"evt-{len(self._mock_events) + 101}",
            "summary": summary,
            "start": start_time,
            "end": end_time or start_time,
            "status": "created",
        }
        self._mock_events.append(evt)
        return evt
`,
  },
  'JARVIS-main/integrations/email_service.py': {
    path: 'JARVIS-main/integrations/email_service.py',
    name: 'email_service.py',
    size: 7000,
    content: `"""Gmail Integration Service for JARVIS with send confirmation guard."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


class EmailService:
    def __init__(self):
        self._messages: List[Dict[str, Any]] = [
            {
                "id": "msg-001",
                "sender": "tony.stark@avengers.org",
                "recipient": "user@jarvis.ai",
                "subject": "Arc Reactor Telemetry Update",
                "body": "Jarvis, review the thermal outputs from the morning test cycle.",
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
            }
        ]

    def list_messages(self, query: str = ""):
        return self._messages

    def send_email(self, to: str, subject: str, body: str, confirmed: bool = False):
        if not confirmed:
            return {
                "requires_confirmation": True,
                "action": "send_email",
                "preview": {"recipient": to, "subject": subject, "body_preview": body[:200]},
                "message": f"Confirmation required to send email to '{to}'.",
            }
        return {"status": "sent", "recipient": to, "subject": subject}
`,
  },
  'JARVIS-main/.env.example': {
    path: 'JARVIS-main/.env.example',
    name: '.env.example',
    size: 2400,
    content: `# JARVIS AI Assistant Configuration
APP_ENV=production
PORT=8000
APP_API_TOKEN=your-random-token-here
ALLOW_NO_AUTH=false

LLM_PROVIDER_ORDER=llm7,pollinations,groq,gemini,openai,claude

# Keyless Providers
LLM7_API_KEY=
LLM_LLM7_MODEL=gpt-oss:20b
LLM_POLLINATIONS_MODEL=openai

# Commercial Providers
GROQ_API_KEY=
LLM_GROQ_MODEL=llama-3.3-70b-versatile
GEMINI_API_KEY=
LLM_GEMINI_MODEL=gemini-2.5-flash
OPENAI_API_KEY=
LLM_OPENAI_MODEL=gpt-4o-mini
ANTHROPIC_API_KEY=
LLM_CLAUDE_MODEL=claude-3-5-sonnet-latest

# Google Services
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
DEFAULT_TIMEZONE=Asia/Kolkata
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=

# Database
DATABASE_URL=
SQLITE_PATH=jarvis.db
`,
  },
  'JARVIS-main/render.yaml': {
    path: 'JARVIS-main/render.yaml',
    name: 'render.yaml',
    size: 1200,
    originalContent: ORIGINAL_V1_FILES['JARVIS-main/render.yaml'],
    content: `services:
  - type: web
    name: jarvis-backend
    runtime: python
    plan: free
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn app:app --workers 1 --threads 4 --timeout 300 --bind 0.0.0.0:$PORT
    healthCheckPath: /health
    envVars:
      - key: PYTHON_VERSION
        value: 3.11.9
      - key: APP_API_TOKEN
        sync: false
      - key: LLM_PROVIDER_ORDER
        value: llm7,pollinations,groq,gemini,openai,claude
      - key: DEFAULT_TIMEZONE
        value: Asia/Kolkata
      - key: KEEPALIVE_ENABLED
        value: "true"
      - key: PING_INTERVAL_SECONDS
        value: "240"
`,
  },
  'JARVIS-main/README.md': {
    path: 'JARVIS-main/README.md',
    name: 'README.md',
    size: 5400,
    content: `# JARVIS AI Assistant Backend v2.0 (Production Edition)

Production-grade Flask backend for JARVIS — Just A Rather Very Intelligent System.
Includes SSE streaming, multi-provider AI fallback, Android device actions, Calendar, and Gmail integrations.

### API Reference
- \`POST /api/chat/stream\`: SSE token streaming
- \`POST /api/chat\`: Live assistant request
- \`GET /api/calendar/events\`: Google Calendar with Asia/Kolkata timezone
- \`POST /api/email/send\`: Gmail with 2-step confirmation
- \`GET /health\`: System health & provider status
`,
  },
};
