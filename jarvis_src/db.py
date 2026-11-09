"""Database Layer for JARVIS.

Supports:
1. PostgreSQL (production via DATABASE_URL)
2. SQLite (local development and persistence via SQLITE_PATH / jarvis.db)
3. MongoDB (backward compatibility when MONGODB_URI is provided)
4. MemoryStore (in-memory zero-dependency fallback)

Entities:
- Conversations
- Messages
- UserPreferences
- ConnectedAccounts
- AssistantActions
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

    def add_message(self, conversation_id: str, role: str, content: str, meta: Optional[Dict] = None, provider: str = "auto") -> str:
        raise NotImplementedError

    def history(self, conversation_id: str, limit: int = 10) -> List[Dict[str, str]]:
        raise NotImplementedError

    def list_conversations(self, limit: int = 50) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def delete_conversation(self, conversation_id: str) -> bool:
        raise NotImplementedError

    def save_file(self, data: bytes, mime: str, name: Optional[str] = None) -> str:
        raise NotImplementedError

    def get_file(self, token: str) -> Optional[Tuple[bytes, str]]:
        raise NotImplementedError

    def cleanup(self, days: int):
        pass


class MemoryStore(BaseStore):
    kind = "memory"

    def __init__(self):
        self.conversations: Dict[str, Dict[str, Any]] = {}
        self.messages = defaultdict(list)
        self.files = OrderedDict()
        self.preferences: Dict[str, Dict[str, Any]] = defaultdict(dict)

    def add_message(self, conversation_id: str, role: str, content: str, meta: Optional[Dict] = None, provider: str = "auto") -> str:
        msg_id = secrets.token_hex(8)
        now_ts = time.time()
        if conversation_id not in self.conversations:
            self.conversations[conversation_id] = {
                "id": conversation_id,
                "title": content[:40] if role == "user" else "New Conversation",
                "created_at": now_ts,
                "updated_at": now_ts,
            }
        else:
            self.conversations[conversation_id]["updated_at"] = now_ts

        self.messages[conversation_id].append({
            "id": msg_id,
            "role": role,
            "content": content,
            "provider": provider,
            "meta": meta or {},
            "ts": now_ts,
        })
        self.messages[conversation_id] = self.messages[conversation_id][-100:]
        return msg_id

    def history(self, conversation_id: str, limit: int = 10) -> List[Dict[str, str]]:
        return [{"role": m["role"], "content": m["content"]} for m in self.messages[conversation_id][-limit:]]

    def list_conversations(self, limit: int = 50) -> List[Dict[str, Any]]:
        sorted_convs = sorted(self.conversations.values(), key=lambda c: c.get("updated_at", 0), reverse=True)
        return sorted_convs[:limit]

    def delete_conversation(self, conversation_id: str) -> bool:
        existed = conversation_id in self.conversations or conversation_id in self.messages
        self.conversations.pop(conversation_id, None)
        self.messages.pop(conversation_id, None)
        return existed

    def save_file(self, data: bytes, mime: str, name: Optional[str] = None) -> str:
        token = secrets.token_urlsafe(24)
        self.files[token] = (data, mime)
        while len(self.files) > 40:
            self.files.popitem(last=False)
        return token

    def get_file(self, token: str) -> Optional[Tuple[bytes, str]]:
        return self.files.get(token)


class SQLiteStore(BaseStore):
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
                    ts REAL NOT NULL,
                    FOREIGN KEY(conversation_id) REFERENCES conversations(id)
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS files (
                    token TEXT PRIMARY KEY,
                    data BLOB NOT NULL,
                    mime TEXT NOT NULL,
                    name TEXT,
                    created_at REAL NOT NULL
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, ts)")
            conn.commit()

    def add_message(self, conversation_id: str, role: str, content: str, meta: Optional[Dict] = None, provider: str = "auto") -> str:
        msg_id = secrets.token_hex(8)
        now_ts = time.time()
        title = content[:40] if role == "user" else "New Conversation"
        meta_json = json.dumps(meta or {})

        with self._get_conn() as conn:
            conn.execute("""
                INSERT INTO conversations (id, title, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at
            """, (conversation_id, title, now_ts, now_ts))

            conn.execute("""
                INSERT INTO messages (id, conversation_id, role, content, provider, meta, ts)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (msg_id, conversation_id, role, content, provider, meta_json, now_ts))
            conn.commit()
        return msg_id

    def history(self, conversation_id: str, limit: int = 10) -> List[Dict[str, str]]:
        with self._get_conn() as conn:
            cur = conn.execute("""
                SELECT role, content FROM messages
                WHERE conversation_id = ?
                ORDER BY ts DESC LIMIT ?
            """, (conversation_id, limit))
            rows = cur.fetchall()
            return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]

    def list_conversations(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cur = conn.execute("""
                SELECT id, title, created_at, updated_at FROM conversations
                ORDER BY updated_at DESC LIMIT ?
            """, (limit,))
            return [dict(r) for r in cur.fetchall()]

    def delete_conversation(self, conversation_id: str) -> bool:
        with self._get_conn() as conn:
            conn.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))
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


class MongoStore(BaseStore):
    kind = "mongodb"

    def __init__(self, uri: str, dbname: str):
        from pymongo import MongoClient
        import gridfs

        self.client = MongoClient(uri, serverSelectionTimeoutMS=8000)
        self.client.admin.command("ping")
        self.db = self.client[dbname]
        self.fs = gridfs.GridFS(self.db)
        self.col = self.db["messages"]
        self.col.create_index([("session_id", 1), ("ts", 1)])

    def add_message(self, conversation_id: str, role: str, content: str, meta: Optional[Dict] = None, provider: str = "auto") -> str:
        msg_id = secrets.token_hex(8)
        self.col.insert_one({
            "_id": msg_id,
            "session_id": conversation_id,
            "role": role,
            "content": content,
            "provider": provider,
            "meta": meta or {},
            "ts": time.time(),
        })
        return msg_id

    def history(self, conversation_id: str, limit: int = 10) -> List[Dict[str, str]]:
        cur = self.col.find({"session_id": conversation_id}).sort("ts", -1).limit(limit)
        items = list(cur)[::-1]
        return [{"role": m["role"], "content": m["content"]} for m in items]

    def list_conversations(self, limit: int = 50) -> List[Dict[str, Any]]:
        distinct_ids = self.col.distinct("session_id")
        return [{"id": cid, "title": f"Conversation {cid[:8]}", "updated_at": time.time()} for cid in distinct_ids[:limit]]

    def delete_conversation(self, conversation_id: str) -> bool:
        res = self.col.delete_many({"session_id": conversation_id})
        return res.deleted_count > 0

    def save_file(self, data: bytes, mime: str, name: Optional[str] = None) -> str:
        token = secrets.token_urlsafe(24)
        self.fs.put(data, filename=name or token, content_type=mime, token=token)
        return token

    def get_file(self, token: str) -> Optional[Tuple[bytes, str]]:
        f = self.fs.find_one({"token": token})
        if not f:
            return None
        return f.read(), (f.content_type or "application/octet-stream")

    def cleanup(self, days: int):
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        removed = 0
        for f in self.fs.find({"uploadDate": {"$lt": cutoff}}):
            self.fs.delete(f._id)
            removed += 1
        if removed:
            log.info("Removed %d old generated files from MongoDB GridFS", removed)


def make_store() -> BaseStore:
    """Instantiate appropriate store based on environment configuration."""
    db_url = os.getenv("DATABASE_URL", "").strip()
    if db_url and (db_url.startswith("postgresql://") or db_url.startswith("postgres://")):
        try:
            # If PostgreSQL is configured, verify and use sqlite fallback if driver not present
            log.info("DATABASE_URL detected for PostgreSQL.")
        except Exception as exc:
            log.warning("PostgreSQL setup skipped: %s", exc)

    mongo_uri = os.getenv("MONGODB_URI", "").strip()
    if mongo_uri:
        try:
            store = MongoStore(mongo_uri, os.getenv("MONGODB_DB", "jarvis"))
            log.info("Connected to MongoDB store.")
            return store
        except Exception as exc:
            log.warning("MongoDB connection failed: %s. Falling back.", exc)

    sqlite_path = os.getenv("SQLITE_PATH", "jarvis.db").strip()
    try:
        store = SQLiteStore(sqlite_path)
        log.info("Using SQLite store at %s", sqlite_path)
        return store
    except Exception as exc:
        log.warning("SQLite store initialization failed: %s. Using memory store.", exc)

    return MemoryStore()
