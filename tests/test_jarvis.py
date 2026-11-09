"""Unit and Integration Tests for JARVIS Backend."""
import json
import unittest
from unittest.mock import MagicMock, patch

import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ["ALLOW_NO_AUTH"] = "true"
os.environ["SQLITE_PATH"] = ":memory:"

from actions import extract_device_actions
from app import app
from db import MemoryStore, SQLiteStore
from integrations.calendar_service import CalendarService
from integrations.email_service import EmailService
from integrations.location_service import LocationService
from providers import LLM7Provider, PollinationsProvider, ProviderRouter


class TestJarvisActions(unittest.TestCase):
    def test_extract_timer_action(self):
        actions = extract_device_actions("Please set a timer for 5 minutes", "")
        self.assertEqual(len(actions), 1)
        self.assertEqual(actions[0]["action"], "set_timer")
        self.assertEqual(actions[0]["seconds"], 300)

    def test_extract_alarm_action(self):
        actions = extract_device_actions("Wake me up at 6:30 am please", "")
        self.assertEqual(len(actions), 1)
        self.assertEqual(actions[0]["action"], "set_alarm")
        self.assertIn("6:30", actions[0]["time"])

    def test_extract_app_launch(self):
        actions = extract_device_actions("open youtube and play music", "")
        self.assertEqual(len(actions), 1)
        self.assertEqual(actions[0]["action"], "open_app")
        self.assertEqual(actions[0]["app"], "youtube")


class TestJarvisIntegrations(unittest.TestCase):
    def test_calendar_service(self):
        svc = CalendarService()
        events = svc.list_events()
        self.assertIsInstance(events, list)
        self.assertGreaterEqual(len(events), 1)

        new_evt = svc.create_event("Test Sync", "2026-11-10T10:00:00Z")
        self.assertEqual(new_evt["status"], "created")

    def test_email_service_confirm(self):
        svc = EmailService()
        res = svc.send_email("boss@stark.com", "Report", "All systems nominal", confirmed=False)
        self.assertTrue(res.get("requires_confirmation"))

        sent = svc.send_email("boss@stark.com", "Report", "All systems nominal", confirmed=True)
        self.assertEqual(sent.get("status"), "sent")

    def test_location_service(self):
        svc = LocationService()
        ctx = svc.process_context(37.7749, -122.4194, query="coffee")
        self.assertEqual(ctx["status"], "active")
        self.assertIn("geo:37.7749,-122.4194", ctx["android_intent_uri"])


class TestJarvisAPI(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_health_endpoint(self):
        resp = self.client.get("/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data.get("status"), "ok")
        self.assertIn("uptime_seconds", data)

    def test_calendar_api(self):
        resp = self.client.get("/api/calendar/events")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertIn("events", data)

    def test_email_messages_api(self):
        resp = self.client.get("/api/email/messages")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data.get("status"), "success")


if __name__ == "__main__":
    unittest.main()
