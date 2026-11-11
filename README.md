# JARVIS AI Assistant Backend v2.1 (Multi-User & Gmail Edition)

Production-grade Python/Flask backend for JARVIS — Just A Rather Very Intelligent System.
Includes full multi-user authentication, Google OAuth 2.0 with strict email match verification, complete Gmail integration with pagination & security safeguards, AI provider fallback, and Android device action dispatchers.

---

## 🚀 Key Features

1. **Multi-User Authentication & Security**:
   - Registration, login, logout, password hashing (Werkzeug PBKDF2/scrypt).
   - JWT Access tokens (1 hour) & Refresh tokens (30 days) with database tracking & rotation.
   - Email verification & password recovery tokens.
   - Strict per-user data isolation: users never see other users' messages, emails, or tokens.
   - At-rest token encryption for third-party OAuth credentials.

2. **Google OAuth 2.0 with Strict Account Match Guard**:
   - Connects Google account to JARVIS user.
   - **Critical Security Invariant**: Rejects connection if the Google account email does not match the registered JARVIS email!
   - Refresh token rotation & automatic access token refreshing.

3. **Complete Gmail Integration (Not Just the Latest Email)**:
   - Mailbox categories: `INBOX`, `SENT`, `DRAFT`, `STARRED`, `IMPORTANT`, `SPAM`, `TRASH`, `ALL`.
   - Full pagination via `pageToken` and `nextPageToken`.
   - Rich message details: Sender, Recipient, Subject, Date, plain-text body, HTML body, labels, attachments metadata.
   - Operations: Mark as read/unread, star/unstar, archive, move to trash/restore, create draft, update draft.
   - Send, Reply, Reply All, Forward with mandatory confirmation preview safeguard.

4. **JARVIS AI Voice & Email Assistant**:
   - Context-aware email assistant: "Check my inbox", "Show unread emails", "Summarize this email", "Draft an email to X".
   - Generates structured device actions for Android APK (`open_app`, `set_timer`, `set_alarm`, `list_emails`, `draft_email`).
   - Real-time SSE token streaming via `POST /api/chat/stream`.

5. **Storage & Deployment**:
   - Zero-setup persistent SQLite (`jarvis.db`) and PostgreSQL support (`DATABASE_URL`).
   - Built-in keepalive loop for Render free tier.

---

## 📡 API Contract for Android Developers

### Authentication Endpoints

#### 1. Register User
`POST /api/auth/register`
```json
{
  "full_name": "Tony Stark",
  "email": "tony@stark.com",
  "password": "SecretPassword123!",
  "confirm_password": "SecretPassword123!"
}
```
**Response (201 Created):**
```json
{
  "status": "success",
  "user": {
    "id": "e9b14c81a2f4",
    "full_name": "Tony Stark",
    "email": "tony@stark.com",
    "is_verified": true
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### 2. Login User
`POST /api/auth/login`
```json
{
  "email": "tony@stark.com",
  "password": "SecretPassword123!"
}
```
**Response (200 OK):**
```json
{
  "status": "success",
  "user": {
    "id": "e9b14c81a2f4",
    "full_name": "Tony Stark",
    "email": "tony@stark.com",
    "is_google_connected": true,
    "google_email": "tony@stark.com"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### 3. Refresh Access Token
`POST /api/auth/refresh`
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

### Google OAuth Endpoints

#### 1. Start Google OAuth
`GET /api/auth/google/start`
**Header:** `Authorization: Bearer <access_token>`
**Response:**
```json
{
  "status": "success",
  "authorization_url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
  "state": "user_id:random_state"
}
```

#### 2. Complete / Connect Google OAuth
`POST /api/auth/google/connect`
**Header:** `Authorization: Bearer <access_token>`
```json
{
  "code": "4/0AeanS0...",
  "redirect_uri": "https://<app>.onrender.com/api/auth/google/callback"
}
```
*Note: If the Google account does not match your JARVIS email, it returns HTTP 403 `ACCOUNT_MISMATCH`.*

---

### Gmail Endpoints

All Gmail endpoints require `Authorization: Bearer <access_token>`.

#### 1. List Emails (with Pagination & Categories)
`GET /api/gmail/messages?category=inbox&maxResults=15&pageToken=optional_token`
**Response:**
```json
{
  "status": "success",
  "category": "inbox",
  "messages": [
    {
      "id": "18f0a2b4",
      "threadId": "18f0a2b4",
      "sender": "Prof. Sharma <placement@university.edu>",
      "recipient": "tony@stark.com",
      "subject": "Campus Placement Drive 2026",
      "date": "2026-11-10 10:15:00",
      "snippet": "Shortlist and interview schedule for Monday...",
      "body_plain": "Full email text content...",
      "body_html": "<p>Full HTML content...</p>",
      "is_unread": true,
      "is_starred": false,
      "labels": ["INBOX", "UNREAD"],
      "attachments": [
        {
          "id": "att_01",
          "filename": "schedule.pdf",
          "mimeType": "application/pdf",
          "size": 182000
        }
      ]
    }
  ],
  "nextPageToken": "15",
  "resultSizeEstimate": 42
}
```

#### 2. Get Single Email Details
`GET /api/gmail/messages/{id}`

#### 3. Search Mailbox
`GET /api/gmail/search?q=placement&maxResults=15`

#### 4. Email Actions
- Mark Read: `POST /api/gmail/messages/{id}/read`
- Mark Unread: `POST /api/gmail/messages/{id}/unread`
- Star: `POST /api/gmail/messages/{id}/star`
- Unstar: `POST /api/gmail/messages/{id}/unstar`
- Archive: `POST /api/gmail/messages/{id}/archive`
- Trash: `POST /api/gmail/messages/{id}/trash`
- Restore: `POST /api/gmail/messages/{id}/restore`

#### 5. Send Email with Confirmation Safeguard
`POST /api/gmail/send`
```json
{
  "to": "pepper@stark.com",
  "subject": "Board Meeting",
  "body": "I will be arriving at 3 PM.",
  "confirmed": false
}
```
*If `confirmed: false`, JARVIS returns a preview requiring explicit user confirmation before sending.*
To dispatch:
```json
{
  "to": "pepper@stark.com",
  "subject": "Board Meeting",
  "body": "I will be arriving at 3 PM.",
  "confirmed": true
}
```

#### 6. Reply and Forward
- Reply: `POST /api/gmail/messages/{id}/reply` (`{ "body": "...", "reply_all": false, "confirmed": true }`)
- Forward: `POST /api/gmail/messages/{id}/forward` (`{ "to": "colleague@stark.com", "body": "FYI", "confirmed": true }`)

---

## 🤖 AI Assistant with Live Streaming (`POST /api/chat/stream`)
Accepts `message` and streams real-time SSE token chunks:
```
data: {"type": "start", "conversation_id": "c-123", "provider": "llm7"}

data: {"type": "token", "token": "You have "}
data: {"type": "token", "token": "2 unread emails in your inbox."}

data: {"type": "actions", "actions": [{"type": "email_action", "action": "list_emails", "category": "inbox"}]}

data: {"type": "done", "status": "success"}
```

---

## 🛠 Deployment & Setup

1. Copy `.env.example` to `.env`.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run automated tests:
   ```bash
   python -m unittest tests/test_auth_gmail.py
   ```
4. Start server:
   ```bash
   gunicorn app:app --workers 1 --threads 4 --bind 0.0.0.0:$PORT
   ```
