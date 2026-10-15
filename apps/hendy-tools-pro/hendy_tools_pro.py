#!/usr/bin/env python3
"""Small diagnostics CLI for the Hendy media workspace."""
import argparse
from pathlib import Path

VIDEO = {".mp4", ".mov", ".mkv", ".webm", ".avi"}
AUDIO = {".mp3", ".wav", ".aac", ".m4a", ".flac"}
SUBTITLE = {".srt", ".ass", ".vtt"}

def classify(path: Path) -> str:
    ext = path.suffix.lower()
    if ext in VIDEO: return "video"
    if ext in AUDIO: return "audio"
    if ext in SUBTITLE: return "subtitle"
    return "unknown"

def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect media files without uploading them")
    parser.add_argument("path", type=Path)
    args = parser.parse_args()
    if not args.path.exists(): raise SystemExit(f"Path not found: {args.path}")
    paths = [args.path] if args.path.is_file() else sorted(p for p in args.path.rglob("*") if p.is_file())
    for path in paths: print(f"{classify(path):8} {path.stat().st_size:>12} bytes  {path}")

if __name__ == "__main__": main()
