#!/usr/bin/env python3
"""
Publish the newest finished Uma Race Overlay archive into this GitHub Pages repo.

Zero third-party dependencies.

Typical Windows usage:
    py scripts/publish_race.py --git-push

Useful overrides:
    py scripts/publish_race.py --source sample/sample_raw_race.json --round 1 --lobby 1 --race 2
    py scripts\publish_race.py --no-confirm
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CFG_PATH = ROOT / "config" / "tournament.json"
PLAYERS_PATH = ROOT / "config" / "players.json"
INDEX_PATH = ROOT / "data" / "index.json"
STANDINGS_PATH = ROOT / "data" / "standings.json"
RACES_DIR = ROOT / "data" / "races"


def load_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        if default is not None:
            return default
        raise FileNotFoundError(path)
    with path.open("r", encoding="utf-8-sig") as f:
        return json.load(f)


def save_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")
    tmp.replace(path)


def expand_path(raw: str) -> Path:
    # Expand %VAR% even when this script is run outside cmd.exe.
    expanded = raw
    for key, value in os.environ.items():
        expanded = expanded.replace(f"%{key}%", value)
    expanded = os.path.expandvars(os.path.expanduser(expanded))
    return Path(expanded)


def newest_json(directory: Path) -> Path:
    if not directory.exists():
        raise RuntimeError(f"Race archive directory does not exist: {directory}")
    files = [p for p in directory.glob("*.json") if p.is_file()]
    if not files:
        raise RuntimeError(f"No JSON race archives found in: {directory}")
    return max(files, key=lambda p: p.stat().st_mtime)


def horse_array(raw: Any) -> list[dict[str, Any]]:
    """Accept the current overlay archive shape plus a few common wrappers."""
    candidates = [
        raw.get("horses") if isinstance(raw, dict) else None,
        raw.get("data", {}).get("horses") if isinstance(raw, dict) and isinstance(raw.get("data"), dict) else None,
        raw.get("race", {}).get("horses") if isinstance(raw, dict) and isinstance(raw.get("race"), dict) else None,
        raw.get("race_horse_data_array") if isinstance(raw, dict) else None,
        raw.get("raceHorseDataArray") if isinstance(raw, dict) else None,
    ]
    for c in candidates:
        if isinstance(c, list) and c:
            return [x for x in c if isinstance(x, dict)]
    raise RuntimeError("Could not find a horse list in the source JSON.")


def first(obj: dict[str, Any], *keys: str, default=None):
    for k in keys:
        if k in obj and obj[k] is not None:
            return obj[k]
    return default


def normalize_horse(h: dict[str, Any]) -> dict[str, Any] | None:
    place = first(h, "order", "finish_order", "finishOrder", "rank")
    finished = first(h, "finished", "is_finished", "isFinished", default=True)

    try:
        place = int(place)
    except (TypeError, ValueError):
        return None
    if place <= 0 or finished is False:
        return None

    gate = first(h, "gate", "frame_order", "frameOrder", "number")
    try:
        gate = int(gate) if gate is not None else None
    except (TypeError, ValueError):
        gate = None

    uma = str(first(h, "name", "chara_name", "charaName", "uma", default="Unknown"))
    trainer = str(first(h, "trainer", "trainer_name", "trainerName", "viewer_name", "viewerName", default="")).strip()

    t = first(h, "finish_time", "finishTime", "finish_time_raw", "finishTimeRaw")
    try:
        t = float(t) if t is not None else None
    except (TypeError, ValueError):
        t = None

    return {
        "place": place,
        "gate": gate,
        "uma": uma,
        "trainer": trainer,
        "time_seconds": t,
    }


def fmt_time(seconds: float | None) -> str | None:
    if seconds is None:
        return None
    minutes = int(seconds // 60)
    rem = seconds - minutes * 60
    return f"{minutes}:{rem:06.3f}"


def load_players() -> dict[str, Any]:
    raw = load_json(PLAYERS_PATH, {})
    return {k: v for k, v in raw.items() if not k.startswith("_") and isinstance(v, dict)}


def process_race(raw_path: Path, round_no: int, lobby_no: int, race_no: int, cfg: dict[str, Any]) -> dict[str, Any]:
    raw = load_json(raw_path)

    if isinstance(raw, dict) and raw.get("running") is True:
        raise RuntimeError("The newest source file says the race is still running.")

    rows = []
    for h in horse_array(raw):
        n = normalize_horse(h)
        if n:
            rows.append(n)

    rows.sort(key=lambda x: x["place"])
    if not rows:
        raise RuntimeError("No finished horses with placement data were found.")

    seen_places = [x["place"] for x in rows]
    if len(set(seen_places)) != len(seen_places):
        raise RuntimeError("Duplicate finishing places detected; refusing to publish.")

    expected = cfg.get("expected_entries")
    if expected is not None and int(expected) != len(rows):
        raise RuntimeError(f"Expected {expected} finishers but found {len(rows)}.")

    players = load_players()
    points = cfg.get("points_by_place", {})

    for x in rows:
        p = players.get(x["trainer"], {})
        x["display_trainer"] = p.get("display_name") or x["trainer"] or "Unknown trainer"
        x["club"] = p.get("club") or p.get("team")
        x["time_display"] = fmt_time(x["time_seconds"])
        x["points"] = int(points.get(str(x["place"]), 0))

    race_id = f"r{round_no}-l{lobby_no}-race{race_no}"
    return {
        "id": race_id,
        "round": round_no,
        "lobby": lobby_no,
        "race": race_no,
        "published_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source_file": raw_path.name,
        "results": rows,
    }


def update_manifest(race: dict[str, Any]) -> None:
    idx = load_json(INDEX_PATH, {"updated_at": None, "races": []})
    rel = f"data/races/{race['id']}.json"
    entry = {
        "id": race["id"],
        "round": race["round"],
        "lobby": race["lobby"],
        "race": race["race"],
        "published_at": race["published_at"],
        "file": rel,
    }
    races = [x for x in idx.get("races", []) if x.get("id") != race["id"]]
    races.append(entry)
    races.sort(key=lambda x: (x["round"], x["lobby"], x["race"]))
    idx["races"] = races
    idx["updated_at"] = race["published_at"]
    save_json(INDEX_PATH, idx)


def rebuild_standings() -> None:
    idx = load_json(INDEX_PATH, {"races": []})
    trainers = defaultdict(lambda: {"points": 0, "wins": 0, "races": 0})
    clubs = defaultdict(lambda: {"points": 0, "wins": 0, "races": 0})

    for meta in idx.get("races", []):
        race_path = ROOT / meta["file"]
        if not race_path.exists():
            continue
        race = load_json(race_path)
        seen_trainer = set()
        seen_club = set()
        for x in race.get("results", []):
            trainer = x.get("display_trainer") or x.get("trainer") or "Unknown trainer"
            trainers[trainer]["points"] += int(x.get("points", 0))
            if x.get("place") == 1:
                trainers[trainer]["wins"] += 1
            if trainer not in seen_trainer:
                trainers[trainer]["races"] += 1
                seen_trainer.add(trainer)

            club = x.get("club") or x.get("team")
            if club:
                clubs[club]["points"] += int(x.get("points", 0))
                if x.get("place") == 1:
                    clubs[club]["wins"] += 1
                if club not in seen_club:
                    clubs[club]["races"] += 1
                    seen_club.add(club)

    trainer_rows = [
        {"trainer": k, **v} for k, v in trainers.items()
    ]
    club_rows = [
        {"club": k, **v} for k, v in clubs.items()
    ]
    trainer_rows.sort(key=lambda x: (-x["points"], -x["wins"], x["trainer"].lower()))
    club_rows.sort(key=lambda x: (-x["points"], -x["wins"], x["club"].lower()))

    save_json(STANDINGS_PATH, {
        "updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "trainers": trainer_rows,
        "clubs": club_rows,
    })


def preview(race: dict[str, Any]) -> None:
    print()
    print(f"Round {race['round']} · Lobby {race['lobby']} · Race {race['race']}")
    print(f"Source: {race['source_file']}")
    print("-" * 78)
    print(f"{'#':>2}  {'Gate':>4}  {'Uma':<24} {'Trainer':<24} {'Time':>9} {'Pts':>4}")
    print("-" * 78)
    for x in race["results"]:
        print(
            f"{x['place']:>2}  {str(x['gate'] or '-'):>4}  "
            f"{x['uma'][:24]:<24} {x['display_trainer'][:24]:<24} "
            f"{(x['time_display'] or '-'):>9} {x['points']:>4}"
        )
    print("-" * 78)
    print()


def git_push(race_id: str) -> None:
    commands = [
        ["git", "add", "data", "config/tournament.json", "config/players.json"],
        ["git", "commit", "-m", f"Publish {race_id}"],
        ["git", "push"],
    ]
    for cmd in commands:
        print("+", " ".join(cmd))
        result = subprocess.run(cmd, cwd=ROOT)
        if result.returncode != 0:
            if cmd[1] == "commit":
                print("Git commit failed or there was nothing new to commit.")
            raise RuntimeError(f"Command failed: {' '.join(cmd)}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", help="Explicit source race JSON. Defaults to newest archive.")
    ap.add_argument("--round", type=int, dest="round_no")
    ap.add_argument("--lobby", type=int, dest="lobby_no")
    ap.add_argument("--race", type=int, dest="race_no")
    ap.add_argument("--no-confirm", action="store_true")
    ap.add_argument("--git-push", action="store_true", help="Commit and push after publishing.")
    args = ap.parse_args()

    cfg = load_json(CFG_PATH)
    source = Path(args.source).resolve() if args.source else newest_json(expand_path(cfg["source_directory"]))
    round_no = args.round_no or int(cfg.get("current_round", 1))
    lobby_no = args.lobby_no or int(cfg.get("current_lobby", 1))
    race_no = args.race_no or int(cfg.get("next_race", 1))

    race = process_race(source, round_no, lobby_no, race_no, cfg)
    preview(race)

    if not args.no_confirm:
        answer = input("Publish this race? [y/N] ").strip().lower()
        if answer not in {"y", "yes"}:
            print("Cancelled. Nothing changed.")
            return 0

    RACES_DIR.mkdir(parents=True, exist_ok=True)
    out = RACES_DIR / f"{race['id']}.json"
    save_json(out, race)
    update_manifest(race)
    rebuild_standings()

    if cfg.get("auto_advance_race", True) and args.race_no is None:
        cfg["next_race"] = race_no + 1
        save_json(CFG_PATH, cfg)

    print(f"Published locally: {out.relative_to(ROOT)}")

    if args.git_push:
        git_push(race["id"])
        print("Pushed to GitHub.")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nCancelled.")
        raise SystemExit(130)
    except Exception as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
