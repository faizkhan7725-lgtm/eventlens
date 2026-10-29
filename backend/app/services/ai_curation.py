from __future__ import annotations

import json
import logging
from io import BytesIO
from typing import Any

from PIL import Image

from app.config import settings

logger = logging.getLogger(__name__)


def analyze_photo_with_gemini(image_bytes: bytes) -> dict[str, Any]:
    """Analyzes photo content using Gemini API for tags, scene description, and quality assessment.

    Gracefully falls back to basic defaults if GEMINI_API_KEY is not configured or in case of network issues.
    Cost: $0 when API key is omitted; uses standard free-tier limits when key is configured.
    """
    default_result = {
        "scene_description": "Event photo",
        "tags": ["event", "photo"],
        "is_blurry": False,
        "has_blink": False,
        "quality_rating": "good",
    }

    api_key = settings.gemini_api_key.strip() if settings.gemini_api_key else ""
    if not api_key:
        return default_result

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        # Optimize image for Gemini token efficiency (max 1024px)
        with Image.open(BytesIO(image_bytes)) as img:
            if img.mode != "RGB":
                img = img.convert("RGB")
            if max(img.size) > 1024:
                img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
            buf = BytesIO()
            img.save(buf, format="JPEG", quality=85)
            optimized_bytes = buf.getvalue()

        prompt = (
            "Analyze this event photo. Provide a concise JSON response with:\n"
            "1. 'scene_description': a concise one-sentence description of the scene.\n"
            "2. 'tags': 3 to 6 lowercase keywords/tags representing what is in the photo (e.g. 'bride', 'cake cutting', 'dancing', 'group photo', 'candid', 'decor').\n"
            "3. 'is_blurry': boolean true if the main subjects are visibly out of focus or motion blurred.\n"
            "4. 'has_blink': boolean true if any prominent subject has their eyes closed mid-blink.\n"
            "5. 'quality_rating': one of 'excellent', 'good', 'needs_review'.\n"
            "Output ONLY valid JSON."
        )

        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=[
                types.Part.from_bytes(data=optimized_bytes, mime_type="image/jpeg"),
                prompt,
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )

        if response and response.text:
            parsed = json.loads(response.text)
            return {
                "scene_description": str(parsed.get("scene_description", "Event photo")),
                "tags": [str(t).lower().strip() for t in parsed.get("tags", ["event", "photo"]) if t],
                "is_blurry": bool(parsed.get("is_blurry", False)),
                "has_blink": bool(parsed.get("has_blink", False)),
                "quality_rating": str(parsed.get("quality_rating", "good")),
            }
        return default_result

    except Exception as exc:
        logger.warning("Gemini photo analysis skipped or failed: %s", exc)
        return default_result
