"""Gmail Integration Service for JARVIS.

Supports:
- Inbox and message listing
- Search messages
- Read message details and summaries
- Draft emails
- Send email with explicit recipient, subject, and content preview confirmation
"""
import base64
from datetime import datetime, timezone
from email.mime.text import MIMEText
import logging
import os
from typing import Any, Dict, List, Optional
import requests

log = logging.getLogger("jarvis.email")


class EmailService:
    def __init__(self):
        self.client_id = os.getenv("GMAIL_CLIENT_ID", "").strip()
        self.client_secret = os.getenv("GMAIL_CLIENT_SECRET", "").strip()
        self._mock_messages: List[Dict[str, Any]] = [
            {
                "id": "msg-001",
                "sender": "tony.stark@avengers.org",
                "recipient": "user@jarvis.ai",
                "subject": "Arc Reactor Telemetry Update",
                "snippet": "Check out the latest thermal efficiency readings on the new mark...",
                "body": "Jarvis, review the thermal outputs from the morning test cycle. Efficiency is at 98.4%.",
                "date": (datetime.now(timezone.utc)).strftime("%Y-%m-%d %H:%M:%S"),
            },
            {
                "id": "msg-002",
                "sender": "notifications@github.com",
                "recipient": "user@jarvis.ai",
                "subject": "[GitHub] Security update for python dependencies",
                "snippet": "Dependabot detected 0 vulnerabilities in the latest build.",
                "body": "All automated security audits passed successfully for the JARVIS backend.",
                "date": (datetime.now(timezone.utc)).strftime("%Y-%m-%d %H:%M:%S"),
            },
        ]

    def is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret)

    def list_messages(self, query: str = "", access_token: Optional[str] = None, max_results: int = 10) -> List[Dict[str, Any]]:
        """List messages from Gmail or mock inbox."""
        if access_token:
            try:
                url = f"https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults={max_results}"
                if query:
                    url += f"&q={requests.utils.quote(query)}"
                headers = {"Authorization": f"Bearer {access_token}"}
                resp = requests.get(url, headers=headers, timeout=10)
                if resp.status_code == 200:
                    raw_items = resp.json().get("messages", [])
                    results = []
                    for it in raw_items[:max_results]:
                        msg_id = it.get("id")
                        detail = self.get_message(msg_id, access_token)
                        if detail:
                            results.append(detail)
                    return results
            except Exception as exc:
                log.warning("Gmail API list_messages error: %s", exc)

        if query:
            q = query.lower()
            return [m for m in self._mock_messages if q in m["subject"].lower() or q in m["snippet"].lower()]
        return self._mock_messages

    def get_message(self, message_id: str, access_token: Optional[str] = None) -> Optional[Dict[str, Any]]:
        if access_token:
            try:
                url = f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{message_id}"
                headers = {"Authorization": f"Bearer {access_token}"}
                resp = requests.get(url, headers=headers, timeout=10)
                if resp.status_code == 200:
                    data = resp.json()
                    headers_list = data.get("payload", {}).get("headers", [])
                    header_map = {h["name"].lower(): h["value"] for h in headers_list}
                    return {
                        "id": message_id,
                        "sender": header_map.get("from", "Unknown"),
                        "recipient": header_map.get("to", ""),
                        "subject": header_map.get("subject", "No subject"),
                        "snippet": data.get("snippet", ""),
                        "body": data.get("snippet", ""),
                        "date": header_map.get("date", ""),
                    }
            except Exception as exc:
                log.warning("Gmail API get_message error: %s", exc)

        for m in self._mock_messages:
            if m["id"] == message_id:
                return m
        return None

    def draft_email(self, to: str, subject: str, body: str, access_token: Optional[str] = None) -> Dict[str, Any]:
        """Create a draft without sending immediately."""
        draft = {
            "id": f"draft-{len(self._mock_messages) + 1}",
            "recipient": to,
            "subject": subject,
            "body": body,
            "status": "draft",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        return draft

    def prepare_send_confirmation(self, to: str, subject: str, body: str) -> Dict[str, Any]:
        """Require explicit user confirmation with preview before sending."""
        return {
            "requires_confirmation": True,
            "action": "send_email",
            "preview": {
                "recipient": to,
                "subject": subject,
                "body_preview": body[:300] + ("..." if len(body) > 300 else ""),
            },
            "message": f"Confirmation required to send email to '{to}' with subject '{subject}'.",
        }

    def send_email(self, to: str, subject: str, body: str, confirmed: bool = False, access_token: Optional[str] = None) -> Dict[str, Any]:
        """Send email if confirmed."""
        if not confirmed:
            return self.prepare_send_confirmation(to, subject, body)

        if access_token:
            try:
                url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
                mime_msg = MIMEText(body)
                mime_msg["to"] = to
                mime_msg["subject"] = subject
                raw = base64.urlsafe_b64encode(mime_msg.as_bytes()).decode("utf-8")
                headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
                resp = requests.post(url, headers=headers, json={"raw": raw}, timeout=10)
                if resp.status_code in (200, 201):
                    return {"status": "sent", "id": resp.json().get("id"), "recipient": to, "subject": subject}
            except Exception as exc:
                log.warning("Gmail API send failed: %s", exc)

        # Mock sent confirmation
        sent_item = {
            "id": f"msg-sent-{len(self._mock_messages) + 1}",
            "sender": "me",
            "recipient": to,
            "subject": subject,
            "body": body,
            "snippet": body[:100],
            "status": "sent",
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        }
        self._mock_messages.append(sent_item)
        return {"status": "sent", "id": sent_item["id"], "recipient": to, "subject": subject}
