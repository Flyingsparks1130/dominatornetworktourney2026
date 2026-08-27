#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, random, secrets
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLUBS = ROOT / "config" / "clubs.json"
BRACKET = ROOT / "data" / "bracket.json"
DRAFTS = ROOT / "data" / "drafts.json"

def load(p):
    with p.open("r", encoding="utf-8-sig") as f:
        return json.load(f)

def save(p, obj):
    with p.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")

def blank_draft(round_no, match_no):
    return {
        "round": round_no, "match": match_no, "status": "not_started",
        "tiebreaker_track": None,
        "track_picks": {"club_a": [], "club_b": []},
        "track_vetoes": {"club_a": None, "club_b": None},
        "final_tracks": [],
        "uma_pre_bans": {"club_a": None, "club_b": None},
        "uma_initial_picks": {"club_a": [], "club_b": []},
        "uma_second_bans": {"club_a": None, "club_b": None},
        "uma_additional_picks": {"club_a": [], "club_b": []},
        "final_uma_pool": {"club_a": [], "club_b": []},
        "benched_uma": {"club_a": None, "club_b": None},
        "build_deadline": None
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", help="Optional reproducible draw seed.")
    args = ap.parse_args()

    data = load(CLUBS)
    clubs = data["clubs"]
    if len(clubs) != 12:
        raise SystemExit(f"Expected 12 clubs, found {len(clubs)}.")

    ids = [c["id"] for c in clubs]
    rng = random.Random(args.seed) if args.seed is not None else secrets.SystemRandom()
    rng.shuffle(ids)
    pos = {cid: i + 1 for i, cid in enumerate(ids)}

    for c in clubs:
        c["draw_order"] = pos[c["id"]]
        c["opening_match"] = ((pos[c["id"]] - 1) // 2) + 1
    clubs.sort(key=lambda c: c["draw_order"])
    save(CLUBS, {"clubs": clubs})

    bracket = load(BRACKET)
    bracket["draw"] = {
        "status": "rolled",
        "method": "random",
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00","Z"),
        "club_count": 12,
        "opening_matches": 6,
        "clubs_per_match": 2,
        "reproducible_seed": args.seed,
    }
    bracket["opening_matches"] = [
        {"match": m, "club_ids": [c["id"] for c in clubs if c["opening_match"] == m]}
        for m in range(1, 7)
    ]
    save(BRACKET, bracket)
    save(DRAFTS, {"matches": {f"r1-m{m}": blank_draft(1,m) for m in range(1,7)}})

    by_id = {c["id"]: c["name"] for c in clubs}
    print("OFFICIAL OPENING DRAW")
    print("=" * 54)
    for match in bracket["opening_matches"]:
        a, b = match["club_ids"]
        print(f"Match {match['match']}: {by_id[a]} vs {by_id[b]}")
    print("=" * 54)
    print("Bracket files have now been published locally.")

if __name__ == "__main__":
    main()
