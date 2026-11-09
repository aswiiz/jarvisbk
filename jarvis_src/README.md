# JARVIS AI Assistant Backend v2.0 (Production Edition)

Production-grade Flask backend for JARVIS — Just A Rather Very Intelligent System.
Designed to power the futuristic JARVIS Android client and web interfaces with real-time AI streaming, multi-provider fallback, structured device control actions, Google Calendar, and Gmail integrations.

---

## ⚡ Core Upgrades in v2.0

1. **Multi-Provider AI Architecture & Automatic Fallback**:
   - Primary: `llm7` (anonymous free or API key)
   - Fallback 1: `pollinations` (keyless anonymous AI provider)
   - Fallback 2: `groq` (ultra fast inference)
   - Fallback 3: `gemini` (Google Gemini 2.5 Flash)
   - Fallback 4: `openai` (GPT-4o mini)
   - Fallback 5: `claude` (Anthropic Claude 3.5 Sonnet)
   - Configurable order via `LLM_PROVIDER_ORDER`. Automatic 30s circuit breaker on rate limits/transient errors.

2. **Real-Time Live Chat with Token Streaming (SSE)**:
   - `POST /api/chat/stream`: Server-Sent Events stream delivering tokens as they arrive.
   - `POST /api/chat/stop`: Cancels active text generation.
   - `POST /api/chat`: Traditional synchronous endpoint with structured JSON response.

3. **Structured Android Device Control Actions**:
   - Parses natural language and returns structured action payloads for the Android APK:
     - `set_timer`: `{ "type": "device_action", "action": "set_timer", "seconds": 300, "label": "Tea" }`
     - `set_alarm`: `{ "type": "device_action", "action": "set_alarm", "time": "06:00" }`
     - `create_reminder`: `{ "type": "device_action", "action": "create_reminder", "text": "Buy groceries", "due": "5pm" }`
     - `open_app`: `{ "type": "device_action", "action": "open_app", "app": "youtube" }`
     - `open_settings`: `{ "type": "device_action", "action": "open_settings", "section": "wifi" }`
     - `open_maps`: `{ "type": "device_action", "action": "open_maps", "query": "coffee shops" }`

4. **Google Calendar & Clock**:
   - `GET /api/calendar/events`: List events with default timezone `Asia/Kolkata`.
   - `POST /api/calendar/events`: Create events with automatic conflict detection.
   - `DELETE /api/calendar/events/<id>`: Delete event.

5. **Gmail Integration with Send-Confirmation Safeguard**:
   - `GET /api/email/messages`: List and search inbox.
   - `POST /api/email/draft`: Save email drafts.
   - `POST /api/email/send`: Enforces preview and explicit confirmation before dispatching.

6. **Unified Storage Engine**:
   - SQLite (`jarvis.db`) for zero-configuration persistent storage.
   - PostgreSQL support via `DATABASE_URL`.
   - MongoDB support via `MONGODB_URI` (GridFS for media).
   - In-memory fallback if no database is reachable.

---

## 📡 API Reference & Android Contract

### 1. Live Chat (`POST /api/chat`)
**Headers:**
```
Content-Type: application/json
X-API-Token: <YOUR_APP_API_TOKEN>
```
**Body:**
```json
{
  "message": "Set a timer for 10 minutes and wake me up at 7am",
  "conversation_id": "conv-12345",
  "provider": "auto"
}
```
**Response:**
```json
{
  "status": "success",
  "conversation_id": "conv-12345",
  "message_id": "a9f82d1c",
  "content": "I have scheduled your 10-minute timer and set an alarm for 7:00 AM.",
  "provider": "llm7",
  "actions": [
    {
      "type": "device_action",
      "action": "set_timer",
      "seconds": 600,
      "label": "JARVIS Timer",
      "requires_confirmation": false
    },
    {
      "type": "device_action",
      "action": "set_alarm",
      "time": "7am",
      "label": "JARVIS Alarm",
      "requires_confirmation": false
    }
  ],
  "tasks": [],
  "timestamp": "2026-11-09T17:15:00Z"
}
```

### 2. Live Streaming Chat (`POST /api/chat/stream`)
Accepts the same body, returns `text/event-stream`:
```
data: {"type": "start", "conversation_id": "conv-12345", "provider": "llm7", "request_id": "req-99"}

data: {"type": "token", "token": "Good "}
data: {"type": "token", "token": "morning, "}
data: {"type": "token", "token": "sir. "}

data: {"type": "actions", "actions": [{"type": "device_action", "action": "set_timer", "seconds": 300}]}

data: {"type": "done", "status": "success", "message_id": "a9f82d1c"}
```

### 3. Conversations Management
- `GET /api/chat/conversations`: List active conversations.
- `GET /api/chat/history?conversation_id=<id>`: Retrieve conversation history.
- `DELETE /api/chat/conversations/<id>`: Delete conversation.

---

## 🛠 Local Setup & Testing

1. Clone or extract the repository:
   ```bash
   cd JARVIS-main
   pip install -r requirements.txt
   ```
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Set `ALLOW_NO_AUTH=true` for local zero-auth testing or generate an `APP_API_TOKEN`.
4. Run the server:
   ```bash
   python app.py
   ```
5. Test endpoints:
   ```bash
   # Health check
   curl -s http://localhost:8000/health

   # Test chat
   curl -s -X POST http://localhost:8000/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello JARVIS"}'
   ```

---

## 🚀 Deploy to Render

1. Push your repository to GitHub.
2. In Render, click **New > Blueprint** and select the repository.
3. Configure the secret environment variables in the Render dashboard:
   - `APP_API_TOKEN`
   - Provider keys: `GROQ_API_KEY`, `GEMINI_API_KEY`, etc. (LLM7 and Pollinations work out of the box without keys)
   - Optional: `GOOGLE_CLIENT_ID`, `GMAIL_CLIENT_ID`, `DATABASE_URL`
4. The service will build and auto-run with keepalive active.
