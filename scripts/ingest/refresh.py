#!/usr/bin/env python3
"""Generate the deployable catalog and verify public YouTube live entries."""
from __future__ import annotations

import json
from datetime import datetime, timezone

from aggregate import (
    META_OUTPUT,
    OUTPUT,
    deduplicate,
    load_legacy,
    load_manual_csv,
    load_remote_sources,
    serialise,
)
from youtube_health import apply_youtube_health


def main() -> None:
    legacy = load_legacy()
    manual = load_manual_csv()
    remote, reports = load_remote_sources()
    cameras = deduplicate([*legacy, *manual, *remote])

    health_report = apply_youtube_health(cameras)
    reports.append(health_report)

    status_counts = {"online": 0, "unknown": 0, "offline": 0}
    for camera in cameras:
        status_counts[camera.status if camera.status in status_counts else "unknown"] += 1

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps({"cameras": [serialise(camera) for camera in cameras]}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    META_OUTPUT.write_text(
        json.dumps(
            {
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "count": len(cameras),
                "statuses": status_counts,
                "sources": {
                    "legacy": len(legacy),
                    "manual": len(manual),
                    "remote": len(remote),
                },
                "reports": reports,
                "policy": "Only zero-cost public sources configured with attribution and licence metadata are ingested.",
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(
        f"Generated {len(cameras)} cameras: "
        f"{status_counts['online']} online, {status_counts['unknown']} unknown, "
        f"{status_counts['offline']} offline"
    )


if __name__ == "__main__":
    main()
