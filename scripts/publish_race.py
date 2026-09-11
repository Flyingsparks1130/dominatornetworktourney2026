"""Compatibility entry point for the current tournament workflow."""
from pathlib import Path
from tournament_engine import build
if __name__ == "__main__":
    result = build(Path(__file__).resolve().parents[1])
    print(f"Indexed {len(result['races'])} race files. Commit and push with GitHub Desktop.")
