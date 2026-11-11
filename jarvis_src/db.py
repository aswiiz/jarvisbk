"""Multi-User Database Layer for JARVIS.

Entities:
- Users (full_name, email, password_hash, is_verified, verification_token, reset_token, reset_token_expires)
- RefreshTokens (user_id, token_hash, expires_at, revoked)
- GoogleAccounts (user_id, google_email, access_token, refresh_token, token_expiry, scope)
- Conversations (id, user_id, title, created_at, updated_at)
- Messages (id, conversation_id, user_id, role, content, provider, meta, ts)
- Files (token, data, mime, name, created_at)
"""
from collections import OrderedDict, defaultdict
from datetime import datetime, timedelta, timezone
import json
import logging
import os
import secrets
import sqlite3
import time
from typing import Any, Dict, List, Optional, Tuple

log = logging.getLogger("jarvis.db")


class BaseStore:
    kind = "base"

    def create_user(self, full_name: str, email: str, password_hash: str, verification_token: Optional[str] = None) -> Dict[str, Any]:
        raise NotImplementedError

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    def verify_user_email(self, token: str) -> bool:
        raise NotImplementedError

    def set_password_reset_token(self, email: str, token: str, expires_at: float) -> bool:
        raise NotImplementedError

    def reset_password(self, token: str, new_password_hash: str) -> bool:
        raise NotImplementedError

    def update_user_password(self, user_id: str, new_password_hash: str) -> bool:
        raise NotImplementedError

    def update_user_profile(self, user_id: str, full_name: str) -> bool:
        raise NotImplementedError

    def store_refresh_token(self, user_id: str, token_hash: str, expires_at: float):
        raise NotImplementedError

    def validate_refresh_token(self, token_hash: str) -> Optional[str]:
        raise NotImplementedError

    def revoke_refresh_token(self, token_hash: str) -> bool:
        raise NotImplementedError

    def save_google_account(self, user_id: str, google_email: str, access_token: str, refresh_token: str, token_expiry: float, scope: str = "") -> Dict[str, Any]:
        raise NotImplementedError

    def get_google_account(self, user_id: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    def disconnect_google_account(self, user_id: str) -> bool:
        raise NotImplementedError

    def add_message(self, conversation_id: str, role: str, content: str, meta: Optional[Dict] = None, provider: str = "auto", user_id: Optional[str] = None) -> str:
        raise NotImplementedError

    def history(self, conversation_id: str, limit: int = 10, user_id: Optional[str] = None) -> List[Dict[str, str]]:
        raise NotImplementedError

    def list_conversations(self, limit: int = 50, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def delete_conversation(self, conversation_id: str, user_id: Optional[str] = None) -> bool:
        raise NotImplementedError

    def save_file(self, data: bytes, mime: str, name: Optional[str] = None) -> str:
        raise NotImplementedError

    def get_file(self, token: str) -> Optional[Tuple[bytes, str]]:
        raise NotImplementedError

    def cleanup(self, days: int):
        pass


class SQLiteStore(BaseStore):
    kind = "sqlite"

    def __init__(self, db_path: str = "jarvis.db"):
        self.db_path = db_path
        self._init_db()

    def _get_conn(self):
        conn = sqlite3.connect(self.db_path, timeout=15)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_db(self):
        with self._get_conn() as conn:
            # Users table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    full_name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    is_verified INTEGER DEFAULT 0,
                    verification_token TEXT,
                    reset_token TEXT,
                    reset_token_expires REAL,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                )
            """)

            # Refresh tokens table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS refresh_tokens (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    token_hash TEXT UNIQUE NOT NULL,
                    expires_at REAL NOT NULL,
                    revoked INTEGER DEFAULT 0,
                    created_at REAL NOT NULL,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)

            # Google account connections table (1-to-1 per user)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS google_accounts (
                    user_id TEXT PRIMARY KEY,
                    google_email TEXT NOT NULL,
                    access_token TEXT NOT NULL,
                    refresh_token TEXT,
                    token_expiry REAL,
                    scope TEXT,
                    connected_at REAL NOT NULL,
                    updated_at REAL NOT NULL,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)

            # Conversations table with user_id
            conn.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    title TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
                )
            """)

            # Messages table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    user_id TEXT,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    provider TEXT DEFAULT 'auto',
                    meta TEXT DEFAULT '{}',
                    ts REAL NOT NULL,
                    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
                )
            """)

            # Files table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS files (
                    token TEXT PRIMARY KEY,
                    data BLOB NOT NULL,
                    mime TEXT NOT NULL,
                    name TEXT,
                    created_at REAL NOT NULL
                )
            """)

            # Indexes
            conn.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_refresh_token_hash ON refresh_tokens(token_hash)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id, updated_at)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, ts)")
            conn.commit()

    # ---------- User Operations ----------

    def create_user(self, full_name: str, email: str, password_hash: str, verification_token: Optional[str] = None) -> Dict[str, Any]:
        user_id = secrets.token_hex(12)
        now = time.time()
        email_clean = email.strip().lower()
        with self._get_conn() as conn:
            conn.execute("""
                INSERT INTO users (id, full_name, email, password_hash, is_verified, verification_token, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (user_id, full_name.strip(), email_clean, password_hash, 0 if verification_token else 1, verification_token, now, now))
            conn.commit()
        return {
            "id": user_id,
            "full_name": full_name.strip(),
            "email": email_clean,
            "is_verified": bool(not verification_token),
            "created_at": now,
        }

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            cur = conn.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),))
            row = cur.fetchone()
            return dict(row) if row else None

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            cur = conn.execute("SELECT id, full_name, email, is_verified, created_at, updated_at FROM users WHERE id = ?", (user_id,))
            row = cur.fetchone()
            return dict(row) if row else None

    def verify_user_email(self, token: str) -> bool:
        if not token:
            return False
        now = time.time()
        with self._get_conn() as conn:
            cur = conn.execute("""
                UPDATE users SET is_verified = 1, verification_token = NULL, updated_at = ?
                WHERE verification_token = ?
            """, (now, token))
            conn.commit()
            return cur.rowcount > 0

    def set_password_reset_token(self, email: str, token: str, expires_at: float) -> bool:
        now = time.time()
        with self._get_conn() as conn:
            cur = conn.execute("""
                UPDATE users SET reset_token = ?, reset_token_expires = ?, updated_at = ?
                WHERE email = ?
            """, (token, expires_at, now, email.strip().lower()))
            conn.commit()
            return cur.rowcount > 0

    def reset_password(self, token: str, new_password_hash: str) -> bool:
        now = time.time()
        with self._get_conn() as conn:
            cur = conn.execute("""
                UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = ?
                WHERE reset_token = ? AND reset_token_expires > ?
            """, (new_password_hash, now, token, now))
            conn.commit()
            return cur.rowcount > 0

    def update_user_password(self, user_id: str, new_password_hash: str) -> bool:
        now = time.time()
        with self._get_conn() as conn:
            cur = conn.execute("""
                UPDATE users SET password_hash = ?, updated_at = ?
                WHERE id = ?
            """, (new_password_hash, now, user_id))
            conn.commit()
            return cur.rowcount > 0

    def update_user_profile(self, user_id: str, full_name: str) -> bool:
        now = time.time()
        with self._get_conn() as conn:
            cur = conn.execute("""
                UPDATE users SET full_name = ?, updated_at = ?
                WHERE id = ?
            """, (full_name.strip(), now, user_id))
            conn.commit()
            return cur.rowcount > 0

    # ---------- Refresh Tokens ----------

    def store_refresh_token(self, user_id: str, token_hash: str, expires_at: float):
        token_id = secrets.token_hex(12)
        now = time.time()
        with self._get_conn() as conn:
            conn.execute("""
                INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked, created_at)
                VALUES (?, ?, ?, ?, 0, ?)
            """, (token_id, user_id, token_hash, expires_at, now))
            conn.commit()

    def validate_refresh_token(self, token_hash: str) -> Optional[str]:
        now = time.time()
        with self._get_conn() as conn:
            cur = conn.execute("""
                SELECT user_id FROM refresh_tokens
                WHERE token_hash = ? AND revoked = 0 AND expires_at > ?
            """, (token_hash, now))
            row = cur.fetchone()
            return row["user_id"] if row else None

    def revoke_refresh_token(self, token_hash: str) -> bool:
        with self._get_conn() as conn:
            cur = conn.execute("UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?", (token_hash,))
            conn.commit()
            return cur.rowcount > 0

    # ---------- Google Accounts Connection ----------

    def save_google_account(self, user_id: str, google_email: str, access_token: str, refresh_token: str, token_expiry: float, scope: str = "") -> Dict[str, Any]:
        now = time.time()
        with self._get_conn() as conn:
            conn.execute("""
                INSERT INTO google_accounts (user_id, google_email, access_token, refresh_token, token_expiry, scope, connected_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    google_email = excluded.google_email,
                    access_token = excluded.access_token,
                    refresh_token = COALESCE(excluded.refresh_token, google_accounts.refresh_token),
                    token_expiry = excluded.token_expiry,
                    scope = excluded.scope,
                    updated_at = excluded.updated_at
            """, (user_id, google_email.strip().lower(), access_token, refresh_token, token_expiry, scope, now, now))
            conn.commit()
        return {
            "user_id": user_id,
            "google_email": google_email.strip().lower(),
            "token_expiry": token_expiry,
            "connected": True,
        }

    def get_google_account(self, user_id: str) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            cur = conn.execute("SELECT * FROM google_accounts WHERE user_id = ?", (user_id,))
            row = cur.fetchone()
            return dict(row) if row else None

    def disconnect_google_account(self, user_id: str) -> bool:
        with self._get_conn() as conn:
            cur = conn.execute("DELETE FROM google_accounts WHERE user_id = ?", (user_id,))
            conn.commit()
            return cur.rowcount > 0

    # ---------- Conversations & Messages (Multi-User) ----------

    def add_message(self, conversation_id: str, role: str, content: str, meta: Optional[Dict] = None, provider: str = "auto", user_id: Optional[str] = None) -> str:
        msg_id = secrets.token_hex(8)
        now_ts = time.time()
        title = content[:40] if role == "user" else "New Conversation"
        meta_json = json.dumps(meta or {})

        with self._get_conn() as conn:
            conn.execute("""
                INSERT INTO conversations (id, user_id, title, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at
            """, (conversation_id, user_id, title, now_ts, now_ts))

            conn.execute("""
                INSERT INTO messages (id, conversation_id, user_id, role, content, provider, meta, ts)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (msg_id, conversation_id, user_id, role, content, provider, meta_json, now_ts))
            conn.commit()
        return msg_id

    def history(self, conversation_id: str, limit: int = 10, user_id: Optional[str] = None) -> List[Dict[str, str]]:
        with self._get_conn() as conn:
            if user_id:
                cur = conn.execute("""
                    SELECT role, content FROM messages
                    WHERE conversation_id = ? AND (user_id = ? OR user_id IS NULL)
                    ORDER BY ts DESC LIMIT ?
                """, (conversation_id, user_id, limit))
            else:
                cur = conn.execute("""
                    SELECT role, content FROM messages
                    WHERE conversation_id = ?
                    ORDER BY ts DESC LIMIT ?
                """, (conversation_id, limit))
            rows = cur.fetchall()
            return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]

    def list_conversations(self, limit: int = 50, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            if user_id:
                cur = conn.execute("""
                    SELECT id, user_id, title, created_at, updated_at FROM conversations
                    WHERE user_id = ?
                    ORDER BY updated_at DESC LIMIT ?
                """, (user_id, limit))
            else:
                cur = conn.execute("""
                    SELECT id, user_id, title, created_at, updated_at FROM conversations
                    ORDER BY updated_at DESC LIMIT ?
                """, (limit,))
            return [dict(r) for r in cur.fetchall()]

    def delete_conversation(self, conversation_id: str, user_id: Optional[str] = None) -> bool:
        with self._get_conn() as conn:
            if user_id:
                cur = conn.execute("DELETE FROM conversations WHERE id = ? AND user_id = ?", (conversation_id, user_id))
            else:
                cur = conn.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
            conn.commit()
            return cur.rowcount > 0

    def save_file(self, data: bytes, mime: str, name: Optional[str] = None) -> str:
        token = secrets.token_urlsafe(24)
        now_ts = time.time()
        with self._get_conn() as conn:
            conn.execute("""
                INSERT INTO files (token, data, mime, name, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (token, data, mime, name or token, now_ts))
            conn.commit()
        return token

    def get_file(self, token: str) -> Optional[Tuple[bytes, str]]:
        with self._get_conn() as conn:
            cur = conn.execute("SELECT data, mime FROM files WHERE token = ?", (token,))
            row = cur.fetchone()
            if row:
                return bytes(row["data"]), row["mime"]
        return None

    def cleanup(self, days: int):
        cutoff = time.time() - (days * 86400)
        with self._get_conn() as conn:
            conn.execute("DELETE FROM files WHERE created_at < ?", (cutoff,))
            conn.commit()


class MemoryStore(BaseStore):
    """In-memory store with user isolation for tests and ephemeral environments."""
    kind = "memory"

    def __init__(self):
        self.users: Dict[str, Dict[str, Any]] = {}
        self.users_by_email: Dict[str, str] = {}
        self.refresh_tokens: Dict[str, Dict[str, Any]] = {}
        self.google_accounts: Dict[str, Dict[str, Any]] = {}
        self.conversations: Dict[str, Dict[str, Any]] = {}
        self.messages = defaultdict(list)
        self.files = OrderedDict()

    def create_user(self, full_name: str, email: str, password_hash: str, verification_token: Optional[str] = None) -> Dict[str, Any]:
        email_clean = email.strip().lower()
        if email_clean in self.users_by_email:
            raise sqlite3.IntegrityError("Email already exists")
        user_id = secrets.token_hex(12)
        user = {
            "id": user_id,
            "full_name": full_name.strip(),
            "email": email_clean,
            "password_hash": password_hash,
            "is_verified": 0 if verification_token else 1,
            "verification_token": verification_token,
            "reset_token": None,
            "reset_token_expires": None,
            "created_at": time.time(),
            "updated_at": time.time(),
        }
        self.users[user_id] = user
        self.users_by_email[email_clean] = user_id
        return {
            "id": user_id,
            "full_name": user["full_name"],
            "email": email_clean,
            "is_verified": bool(user["is_verified"]),
            "created_at": user["created_at"],
        }

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        user_id = self.users_by_email.get(email.strip().lower())
        return self.users.get(user_id) if user_id else None

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        u = self.users.get(user_id)
        if not u:
            return None
        return {k: v for k, v in u.items() if k != "password_hash"}

    def verify_user_email(self, token: str) -> bool:
        for u in self.users.values():
            if u.get("verification_token") == token:
                u["is_verified"] = 1
                u["verification_token"] = None
                return True
        return False

    def set_password_reset_token(self, email: str, token: str, expires_at: float) -> bool:
        user = self.get_user_by_email(email)
        if not user:
            return False
        user["reset_token"] = token
        user["reset_token_expires"] = expires_at
        return True

    def reset_password(self, token: str, new_password_hash: str) -> bool:
        now = time.time()
        for u in self.users.values():
            if u.get("reset_token") == token and (u.get("reset_token_expires") or 0) > now:
                u["password_hash"] = new_password_hash
                u["reset_token"] = None
                u["reset_token_expires"] = None
                return True
        return False

    def update_user_password(self, user_id: str, new_password_hash: str) -> bool:
        u = self.users.get(user_id)
        if not u:
            return False
        u["password_hash"] = new_password_hash
        return True

    def update_user_profile(self, user_id: str, full_name: str) -> bool:
        u = self.users.get(user_id)
        if not u:
            return False
        u["full_name"] = full_name.strip()
        return True

    def store_refresh_token(self, user_id: str, token_hash: str, expires_at: float):
        self.refresh_tokens[token_hash] = {
            "user_id": user_id,
            "expires_at": expires_at,
            "revoked": 0,
        }

    def validate_refresh_token(self, token_hash: str) -> Optional[str]:
        t = self.refresh_tokens.get(token_hash)
        if t and not t["revoked"] and t["expires_at"] > time.time():
            return t["user_id"]
        return None

    def revoke_refresh_token(self, token_hash: str) -> bool:
        if token_hash in self.refresh_tokens:
            self.refresh_tokens[token_hash]["revoked"] = 1
            return True
        return False

    def save_google_account(self, user_id: str, google_email: str, access_token: str, refresh_token: str, token_expiry: float, scope: str = "") -> Dict[str, Any]:
        acct = {
            "user_id": user_id,
            "google_email": google_email.strip().lower(),
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_expiry": token_expiry,
            "scope": scope,
            "connected_at": time.time(),
            "updated_at": time.time(),
        }
        self.google_accounts[user_id] = acct
        return acct

    def get_google_account(self, user_id: str) -> Optional[Dict[str, Any]]:
        return self.google_accounts.get(user_id)

    def disconnect_google_account(self, user_id: str) -> bool:
        return bool(self.google_accounts.pop(user_id, None))

    def add_message(self, conversation_id: str, role: str, content: str, meta: Optional[Dict] = None, provider: str = "auto", user_id: Optional[str] = None) -> str:
        msg_id = secrets.token_hex(8)
        now_ts = time.time()
        if conversation_id not in self.conversations:
            self.conversations[conversation_id] = {
                "id": conversation_id,
                "user_id": user_id,
                "title": content[:40] if role == "user" else "New Conversation",
                "created_at": now_ts,
                "updated_at": now_ts,
            }
        else:
            self.conversations[conversation_id]["updated_at"] = now_ts

        self.messages[conversation_id].append({
            "id": msg_id,
            "conversation_id": conversation_id,
            "user_id": user_id,
            "role": role,
            "content": content,
            "provider": provider,
            "meta": meta or {},
            "ts": now_ts,
        })
        self.messages[conversation_id] = self.messages[conversation_id][-100:]
        return msg_id

    def history(self, conversation_id: str, limit: int = 10, user_id: Optional[str] = None) -> List[Dict[str, str]]:
        msgs = self.messages[conversation_id]
        if user_id:
            msgs = [m for m in msgs if m.get("user_id") == user_id or m.get("user_id") is None]
        return [{"role": m["role"], "content": m["content"]} for m in msgs[-limit:]]

    def list_conversations(self, limit: int = 50, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        convs = list(self.conversations.values())
        if user_id:
            convs = [c for c in convs if c.get("user_id") == user_id]
        sorted_convs = sorted(convs, key=lambda c: c.get("updated_at", 0), reverse=True)
        return sorted_convs[:limit]

    def delete_conversation(self, conversation_id: str, user_id: Optional[str] = None) -> bool:
        conv = self.conversations.get(conversation_id)
        if not conv:
            return False
        if user_id and conv.get("user_id") != user_id:
            return False
        self.conversations.pop(conversation_id, None)
        self.messages.pop(conversation_id, None)
        return True

    def save_file(self, data: bytes, mime: str, name: Optional[str] = None) -> str:
        token = secrets.token_urlsafe(24)
        self.files[token] = (data, mime)
        while len(self.files) > 40:
            self.files.popitem(last=False)
        return token

    def get_file(self, token: str) -> Optional[Tuple[bytes, str]]:
        return self.files.get(token)


def make_store() -> BaseStore:
    """Instantiate appropriate multi-user store based on environment configuration."""
    db_url = os.getenv("DATABASE_URL", "").strip()
    if db_url and (db_url.startswith("postgresql://") or db_url.startswith("postgres://")):
        log.info("DATABASE_URL detected for PostgreSQL.")

    sqlite_path = os.getenv("SQLITE_PATH", "jarvis.db").strip()
    try:
        store = SQLiteStore(sqlite_path)
        log.info("Using SQLite store at %s", sqlite_path)
        return store
    except Exception as exc:
        log.warning("SQLite store initialization failed: %s. Using memory store.", exc)

    return MemoryStore()
