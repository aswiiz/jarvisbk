"""Location and Navigation Context Service for JARVIS.

Supports:
- Location-aware requests (nearby searches, route planning intents)
- Contextual queries using client-supplied coordinates (no continuous unauthorized tracking)
"""
import logging
from typing import Any, Dict, List, Optional

log = logging.getLogger("jarvis.location")


class LocationService:
    def process_context(
        self,
        latitude: float,
        longitude: float,
        query: Optional[str] = None,
        accuracy: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Process validated client coordinates without persistent location harvesting."""
        # Simple coordinate validation
        if not (-90.0 <= latitude <= 90.0) or not (-180.0 <= longitude <= 180.0):
            raise ValueError("Invalid coordinates provided")

        context = {
            "coordinates": {
                "latitude": latitude,
                "longitude": longitude,
                "accuracy_meters": accuracy or 10.0,
            },
            "status": "active",
        }

        if query:
            context["query"] = query
            context["intent"] = "nearby_search"
            # Format navigation intent URL compatible with Android Google Maps Intent
            context["android_intent_uri"] = f"geo:{latitude},{longitude}?q={query}"
            context["web_maps_url"] = f"https://www.google.com/maps/search/{query}/@{latitude},{longitude},14z"

        return context
