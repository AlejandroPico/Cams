#!/usr/bin/env python3
"""Zero-cost availability checks for public YouTube webcam entries.

The checker only reads public oEmbed/watch endpoints. It does not use credentials,
bypass access controls or download media streams.
"""
from __future__ import annotations

import re
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any, Iterable

BROWSER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/142.0 Safari/537.36 CamsCatalogBot/3.1"
)


def _request_text(url: str, timeout: int = 16) -> tuple[int, str]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": BROWSER_AGENT,
            "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            return response.status, response.read().decode(charset, errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, ""


def check_youtube_video(video_id: str) -> str:
    """Return online, offline or unknown for a public YouTube video ID."""
    watch_url = f"https://www.youtube.com/watch?v={urllib.parse.quote(video_id)}"
    oembed_url = (
        "https://www.youtube.com/oembed?format=json&url="
        + urllib.parse.quote(watch_url, safe="")
    )

    try:
        oembed_status, _ = _request_text(oembed_url, timeout=12)
    except (OSError, TimeoutError, urllib.error.URLError):
        return "unknown"

    if oembed_status in {401, 404, 410}:  # removed, private or unavailable
        return "offline"
    if oembed_status in {403, 429} or oembed_status >= 500:
        return "unknown"
    if oembed_status != 200:
        return "unknown"

    try:
        page_status, page = _request_text(f"{watch_url}&hl=en&persist_hl=1", timeout=18)
    except (OSError, TimeoutError, urllib.error.URLError):
        return "unknown"

    if page_status in {401, 404, 410}:
        return "offline"
    if page_status in {403, 429} or page_status >= 500:
        return "unknown"

    if re.search(r'"isLiveNow"\s*:\s*true', page):
        return "online"
    if re.search(r'"isUpcoming"\s*:\s*true', page):
        return "unknown"
    if "LIVE_STREAM_OFFLINE" in page:
        return "offline"

    # A normal video page with metadata but without isLiveNow is a recording,
    # not a currently active webcam stream.
    has_video_metadata = '"videoDetails"' in page or '"isLiveContent"' in page
    if has_video_metadata:
        return "offline"

    # Consent pages, rate-limit interstitials and unexpected HTML are not treated
    # as a definitive failure.
    return "unknown"


def apply_youtube_health(cameras: Iterable[Any], workers: int = 12) -> dict[str, Any]:
    targets = [camera for camera in cameras if getattr(camera, "type", "") == "youtube" and getattr(camera, "videoId", None)]
    counts = {"online": 0, "offline": 0, "unknown": 0}
    checked_at = datetime.now(timezone.utc).isoformat()

    if not targets:
        return {"name": "YouTube public live check", "status": "ok", "checked": 0, **counts}

    with ThreadPoolExecutor(max_workers=max(1, min(workers, 20))) as executor:
        future_to_camera = {
            executor.submit(check_youtube_video, str(camera.videoId)): camera
            for camera in targets
        }
        for future in as_completed(future_to_camera):
            camera = future_to_camera[future]
            try:
                status = future.result()
            except Exception:  # one failed request must not stop the catalog build
                status = "unknown"
            if status not in counts:
                status = "unknown"
            camera.status = status
            camera.lastCheckedAt = checked_at
            counts[status] += 1

    return {
        "name": "YouTube public live check",
        "status": "ok",
        "checked": len(targets),
        **counts,
    }
