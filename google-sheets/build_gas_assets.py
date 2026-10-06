#!/usr/bin/env python3
"""Generate Apps Script HTML includes from static portal assets."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
CSS = REPO / "static" / "css" / "portal.css"
JS = REPO / "static" / "js" / "portal.js"


def main() -> None:
    css = CSS.read_text(encoding="utf-8")
    js = JS.read_text(encoding="utf-8")
    (ROOT / "PortalStyles.html").write_text(
        f"<style>\n{css}\n</style>\n",
        encoding="utf-8",
    )
    (ROOT / "PortalScript.html").write_text(
        f"<script>\n{js}\n</script>\n",
        encoding="utf-8",
    )
    print("Wrote PortalStyles.html and PortalScript.html")


if __name__ == "__main__":
    main()
