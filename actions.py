"""Structured Assistant and Device Actions for JARVIS.

Interprets requests for Android device actions, alarms, timers, reminders, and system settings.
The backend outputs structured action instructions so the Android client can execute them locally.
"""
import re
from typing import Any, Dict, List, Optional


def extract_device_actions(user_message: str, assistant_response: str) -> List[Dict[str, Any]]:
    """Inspect user request and assistant answer to detect intended Android actions."""
    actions: List[Dict[str, Any]] = []
    msg = user_message.lower().strip()

    # 1. Timers
    # "set a timer for 5 minutes", "timer for 30 seconds", "start 10 minute timer"
    timer_match = re.search(r'(?:set|start|create)?\s*(?:a\s+)?timer\s+(?:for\s+)?(\d+)\s*(min(?:ute)?s?|sec(?:ond)?s?|hours?|hrs?)', msg)
    if timer_match:
        val = int(timer_match.group(1))
        unit = timer_match.group(2)
        multiplier = 60
        if "sec" in unit:
            multiplier = 1
        elif "hour" in unit or "hr" in unit:
            multiplier = 3600
        seconds = val * multiplier
        actions.append({
            "type": "device_action",
            "action": "set_timer",
            "seconds": seconds,
            "label": "JARVIS Timer",
            "requires_confirmation": False,
        })

    # 2. Alarms
    # "set alarm for 6 am", "wake me up at 7:30 am", "set alarm for 06:00"
    alarm_match = re.search(r'(?:set\s+(?:an?\s+)?alarm(?:\s+for)?|wake\s+me\s+up\s+at)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)', msg)
    if alarm_match:
        time_str = alarm_match.group(1).strip()
        actions.append({
            "type": "device_action",
            "action": "set_alarm",
            "time": time_str,
            "label": "JARVIS Alarm",
            "requires_confirmation": False,
        })

    # 3. Reminders
    # "remind me to buy milk tomorrow at 5pm", "create reminder to call John"
    reminder_match = re.search(r'remind\s+(?:me\s+to\s+|me\s+about\s+)(.+?)(?:\s+(?:at|on|tomorrow|in)\s+(.+))?$', msg)
    if reminder_match:
        task_text = reminder_match.group(1).strip()
        due = reminder_match.group(2).strip() if reminder_match.group(2) else "unspecified"
        actions.append({
            "type": "device_action",
            "action": "create_reminder",
            "text": task_text,
            "due": due,
            "requires_confirmation": False,
        })

    # 4. App Launching
    # "open youtube", "launch spotify", "open camera", "open whatsapp", "open maps"
    app_match = re.search(r'(?:open|launch|start)\s+(?:the\s+)?(camera|youtube|spotify|maps|calendar|settings|whatsapp|chrome|calculator|gallery|music|gmail|email)', msg)
    if app_match:
        app_name = app_match.group(1)
        actions.append({
            "type": "device_action",
            "action": "open_app",
            "app": app_name,
            "requires_confirmation": False,
        })

    # 5. Settings navigation
    # "open wifi settings", "open bluetooth settings", "turn on bluetooth"
    settings_match = re.search(r'(?:open|go\s+to)\s+(wifi|bluetooth|display|sound|battery|airplane\s+mode)\s+settings?', msg)
    if settings_match:
        section = settings_match.group(1).replace(" ", "_")
        actions.append({
            "type": "device_action",
            "action": "open_settings",
            "section": section,
            "requires_confirmation": False,
        })

    # 6. Navigation / Map queries
    # "navigate to Central Park", "directions to airport", "take me to coffee shop"
    nav_match = re.search(r'(?:navigate\s+to|directions\s+to|take\s+me\s+to|route\s+to)\s+(.+)', msg)
    if nav_match:
        destination = nav_match.group(1).strip()
        actions.append({
            "type": "device_action",
            "action": "open_maps",
            "query": destination,
            "requires_confirmation": False,
        })

    return actions
