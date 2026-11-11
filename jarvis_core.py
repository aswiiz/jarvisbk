"""Enhanced JARVIS Core Pipeline.

Integrates:
1. Multi-provider AI routing with automatic fallback (LLM7, Pollinations, Groq, Gemini, Claude, OpenAI)
2. Structured Android device & Gmail action parsing
3. Factual email context injection when user asks about emails
4. Streaming token support for SSE
"""
from collections import Counter
import io
import json
import logging
import os
import re
import time
from typing import Any, Dict, Generator, List, Optional, Tuple

from actions import extract_device_actions
from prompts import PLANNER_SYSTEM, RESPONSE_SYSTEM
from providers import ProviderRouter, redact_secrets

log = logging.getLogger("jarvis.core")


class MissingConfig(RuntimeError):
    pass


TASK_REGISTRY = {
    "image-to-text": {
        "input": "image",
        "desc": "Describe or caption an image",
        "models": ["Salesforce/blip-image-captioning-large"],
    },
    "text-to-image": {
        "input": "text",
        "desc": "Generate an image from a text prompt",
        "models": ["black-forest-labs/FLUX.1-schnell"],
    },
    "summarization": {
        "input": "text",
        "desc": "Summarize a long text",
        "models": ["facebook/bart-large-cnn"],
    },
}


def _parse_json(raw: str) -> Dict[str, Any]:
    try:
        return json.loads(raw)
    except Exception:
        m = re.search(r"\{.*\}", raw or "", re.S)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                return {}
    return {}


class Jarvis:
    def __init__(self):
        self.router = ProviderRouter()
        self.hf_token = os.getenv("HUGGINGFACE_ACCESS_TOKEN", "").strip()
        self.max_tasks = int(os.getenv("MAX_TASKS", "6"))
        self._hf = None
        self.registry = {k: dict(v) for k, v in TASK_REGISTRY.items()}

    def status(self) -> Dict[str, Any]:
        return {
            "llm_providers": [p["name"] for p in self.router.get_statuses() if p.get("configured")],
            "all_provider_statuses": self.router.get_statuses(),
            "huggingface": bool(self.hf_token),
        }

    def _inject_context(self, message: str, store: Any, user_id: Optional[str], gmail_service: Optional[Any]) -> str:
        """Inject real authorized email/calendar data if user is asking about emails."""
        msg_lower = message.lower()
        if not user_id or not gmail_service:
            return message

        # Email queries
        if any(k in msg_lower for k in ("inbox", "my email", "unread email", "check email", "emails from", "placement", "interview")):
            try:
                acct = store.get_google_account(user_id) if store else None
                if not acct:
                    return f"{message}\n\n[System Note: User has NOT connected their Google account yet. Inform the user to connect their Google account in Settings to view and search their real Gmail inbox.]"

                # Fetch real mailbox messages
                mb = gmail_service.list_messages(store, user_id, category="inbox", max_results=5)
                msgs = mb.get("messages", [])
                if msgs:
                    summaries = []
                    for i, m in enumerate(msgs[:4]):
                        unread_tag = "[UNREAD] " if m.get("is_unread") else ""
                        summaries.append(f"{i+1}. {unread_tag}From: {m['sender']} | Subject: {m['subject']} | Date: {m['date']}\nPreview: {m['snippet']}")
                    return f"{message}\n\n[Authorized Real Gmail Inbox Data for user {user_id}]:\n" + "\n\n".join(summaries)
                else:
                    return f"{message}\n\n[Authorized Gmail Inbox is empty.]"
            except Exception as exc:
                log.warning("Email context injection error: %s", exc)

        return message

    def run(
        self,
        message: str,
        history: List[Dict[str, str]],
        files: List[Dict[str, Any]],
        store: Any,
        base_url: str,
        provider: str = "auto",
        user_id: Optional[str] = None,
        gmail_service: Optional[Any] = None,
    ) -> Dict[str, Any]:
        enriched_message = self._inject_context(message, store, user_id, gmail_service)
        msgs = [{"role": "system", "content": RESPONSE_SYSTEM}] + history[-8:]
        msgs.append({"role": "user", "content": enriched_message})

        answer, used_provider = self.router.generate_with_fallback(msgs, preferred_provider=provider, temperature=0.35)
        actions = extract_device_actions(message, answer)

        return {
            "response": answer,
            "provider": used_provider,
            "tasks": [],
            "actions": actions,
        }

    def stream_run(
        self,
        message: str,
        history: List[Dict[str, str]],
        files: List[Dict[str, Any]],
        store: Any,
        base_url: str,
        provider: str = "auto",
        user_id: Optional[str] = None,
        gmail_service: Optional[Any] = None,
    ) -> Tuple[Generator[str, None, None], str, List[Dict[str, Any]], List[Dict[str, Any]]]:
        enriched_message = self._inject_context(message, store, user_id, gmail_service)
        msgs = [{"role": "system", "content": RESPONSE_SYSTEM}] + history[-8:]
        msgs.append({"role": "user", "content": enriched_message})

        token_stream, used_provider = self.router.stream_with_fallback(msgs, preferred_provider=provider, temperature=0.35)
        actions = extract_device_actions(message, "")

        return token_stream, used_provider, [], actions
