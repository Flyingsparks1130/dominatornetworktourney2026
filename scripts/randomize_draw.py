#!/usr/bin/env python3
"""Randomize the 12-club Round 1 draw and save it to config/clubs.json + data/bracket.json."""
from __future__ import annotations
import argparse
import json
import random
import secrets
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLUBS_PATH = ROOT / "config" / "clubs.json"
BRACKET_PATH = ROOT / "data" / "bracket.json"

def load(path):
    with path.open("r", encoding="utf-8-sig") as f:
        return json.load(f)

def save(path, obj):
    with path.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", help="Optional reproducible draw seed. Omit for system randomness.")
    args = ap.parse_args()

    data = load(CLUBS_PATH)
    clubs = data["clubs"]
    if len(clubs) != 12:
        raise SystemExit(f"Expected exactly 12 clubs, found {len(clubs)}.")

    ids = [c["id"] for c in clubs]
    if args.seed is None:
        rng = secrets.SystemRandom()
        draw_seed = None
    else:
        rng = random.Random(args.seed)
        draw_seed = str(args.seed)

    rng.shuffle(ids)
    pos = {club_id: i + 1 for i, club_id in enumerate(ids)}

    for c in clubs:
        c["draw_order"] = pos[c["id"]]
        c["r1_lobby"] = ((pos[c["id"]] - 1) // 4) + 1

    clubs.sort(key=lambda c: c["draw_order"])
    save(CLUBS_PATH, {"clubs": clubs})

    bracket = load(BRACKET_PATH)
    bracket["draw"] = {
        "method": "random",
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "club_count": 12,
        "round1_lobbies": 3,
        "clubs_per_lobby": 4,
        "reproducible_seed": draw_seed,
    }
    bracket["r1_lobbies"] = [
        {
            "lobby": lobby,
            "club_ids": [
                c["id"] for c in clubs if c["r1_lobby"] == lobby
            ]
        }
        for lobby in range(1, 4)
    ]
    save(BRACKET_PATH, bracket)

    print("Random Round 1 draw:")
    for lobby in bracket["r1_lobbies"]:
        names = [
            next(c["name"] for c in clubs if c["id"] == cid)
            for cid in lobby["club_ids"]
        ]
        print(f"  Lobby {lobby['lobby']}: " + " | ".join(names))

if __name__ == "__main__":
    main()
