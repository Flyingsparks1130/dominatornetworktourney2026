#!/usr/bin/env python3
"""Publish the newest finished Uma Race Overlay race into a head-to-head Dominator Draft match."""
from __future__ import annotations
import argparse, json, os, subprocess, sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CFG = ROOT/"config"/"tournament.json"
PLAYERS = ROOT/"config"/"players.json"
INDEX = ROOT/"data"/"index.json"
SCORES = ROOT/"data"/"match_scores.json"
RACES = ROOT/"data"/"races"
BRACKET = ROOT/"data"/"bracket.json"

def load(p: Path, default=None):
    if not p.exists():
        if default is not None: return default
        raise FileNotFoundError(p)
    with p.open("r", encoding="utf-8-sig") as f: return json.load(f)

def save(p: Path, obj):
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp=p.with_suffix(p.suffix+".tmp")
    with tmp.open("w",encoding="utf-8",newline="\n") as f:
        json.dump(obj,f,ensure_ascii=False,indent=2);f.write("\n")
    tmp.replace(p)

def expand_path(raw):
    s=raw
    for k,v in os.environ.items(): s=s.replace(f"%{k}%",v)
    return Path(os.path.expanduser(os.path.expandvars(s)))

def newest_json(directory):
    if not directory.exists(): raise RuntimeError(f"Race archive directory does not exist: {directory}")
    files=[p for p in directory.glob("*.json") if p.is_file()]
    if not files: raise RuntimeError(f"No JSON race archives found in: {directory}")
    return max(files,key=lambda p:p.stat().st_mtime)

def horse_array(raw):
    candidates=[
        raw.get("horses") if isinstance(raw,dict) else None,
        raw.get("data",{}).get("horses") if isinstance(raw,dict) and isinstance(raw.get("data"),dict) else None,
        raw.get("race",{}).get("horses") if isinstance(raw,dict) and isinstance(raw.get("race"),dict) else None,
        raw.get("race_horse_data_array") if isinstance(raw,dict) else None,
        raw.get("raceHorseDataArray") if isinstance(raw,dict) else None,
    ]
    for c in candidates:
        if isinstance(c,list) and c: return [x for x in c if isinstance(x,dict)]
    raise RuntimeError("Could not find a horse list in the source JSON.")

def first(obj,*keys,default=None):
    for k in keys:
        if k in obj and obj[k] is not None:return obj[k]
    return default

def normalize(h):
    place=first(h,"order","finish_order","finishOrder","rank")
    finished=first(h,"finished","is_finished","isFinished",default=True)
    try: place=int(place)
    except (TypeError,ValueError): return None
    if place<=0 or finished is False:return None
    gate=first(h,"gate","frame_order","frameOrder","number")
    try: gate=int(gate) if gate is not None else None
    except (TypeError,ValueError): gate=None
    t=first(h,"finish_time","finishTime","finish_time_raw","finishTimeRaw")
    try: t=float(t) if t is not None else None
    except (TypeError,ValueError): t=None
    return {
        "place":place,"gate":gate,
        "uma":str(first(h,"name","chara_name","charaName","uma",default="Unknown")),
        "trainer":str(first(h,"trainer","trainer_name","trainerName","viewer_name","viewerName",default="")).strip(),
        "time_seconds":t
    }

def fmt_time(s):
    if s is None:return None
    m=int(s//60);r=s-m*60
    return f"{m}:{r:06.3f}"

def process(source,round_no,match_no,race_no,cfg,non_scoring_extra):
    raw=load(source)
    if isinstance(raw,dict) and raw.get("running") is True: raise RuntimeError("Newest source says the race is still running.")
    rows=[x for x in (normalize(h) for h in horse_array(raw)) if x]
    rows.sort(key=lambda x:x["place"])
    if not rows: raise RuntimeError("No finishers found.")
    if len(set(x["place"] for x in rows))!=len(rows): raise RuntimeError("Duplicate finishing places detected.")
    expected=cfg.get("expected_entries")
    if expected is not None and int(expected)!=len(rows): raise RuntimeError(f"Expected {expected} finishers but found {len(rows)}.")

    players={k:v for k,v in load(PLAYERS,{}).items() if not k.startswith("_") and isinstance(v,dict)}
    non_scoring=set(cfg.get("non_scoring_trainers",[]))|set(non_scoring_extra or [])
    point_map=cfg.get("points_by_scoring_place",{"1":4,"2":2,"3":1})

    eligible_rank=0
    for x in rows:
        p=players.get(x["trainer"],{})
        x["display_trainer"]=p.get("display_name") or x["trainer"] or "Unknown trainer"
        x["club"]=p.get("club")
        x["time_display"]=fmt_time(x["time_seconds"])
        x["non_scoring"]=x["trainer"] in non_scoring
        if x["non_scoring"]:
            x["scoring_place"]=None;x["points"]=0
        else:
            eligible_rank+=1
            x["scoring_place"]=eligible_rank
            x["points"]=int(point_map.get(str(eligible_rank),0))

    rid=f"r{round_no}-m{match_no}-race{race_no}"
    return {
        "id":rid,"round":round_no,"match":match_no,"race":race_no,
        "is_tiebreaker":race_no>int(cfg.get("standard_races",5)),
        "published_at":datetime.now(timezone.utc).isoformat().replace("+00:00","Z"),
        "source_file":source.name,"results":rows
    }

def update_manifest(race):
    idx=load(INDEX,{"updated_at":None,"races":[]})
    rel=f"data/races/{race['id']}.json"
    entry={k:race[k] for k in ["id","round","match","race","published_at","is_tiebreaker"]}
    entry["file"]=rel
    races=[x for x in idx.get("races",[]) if x.get("id")!=race["id"]]+[entry]
    races.sort(key=lambda x:(x["round"],x["match"],x["race"]))
    idx["races"]=races;idx["updated_at"]=race["published_at"];save(INDEX,idx)

def rebuild_scores(cfg):
    idx=load(INDEX,{"races":[]})
    grouped=defaultdict(list)
    for meta in idx.get("races",[]): grouped[(meta["round"],meta["match"])].append(meta)
    out=[]
    threshold=int(cfg.get("win_threshold",25)); standard=int(cfg.get("standard_races",5))
    for (round_no,match_no),metas in sorted(grouped.items()):
        metas.sort(key=lambda x:x["race"])
        totals=defaultdict(int)
        for meta in metas:
            race=load(ROOT/meta["file"])
            for row in race.get("results",[]):
                if row.get("club"): totals[row["club"]]+=int(row.get("points",0))
        winner=None;status="in_progress"
        reached=[club for club,pts in totals.items() if pts>=threshold]
        if len(reached)==1:
            winner=reached[0];status="winner"
        elif len(reached)>1:
            status="review_required"
        elif len(metas)>=standard:
            status="tiebreaker_required" if len(metas)==standard else "tiebreaker_played"
        out.append({
            "round":round_no,"match":match_no,"races_published":len(metas),
            "club_points":dict(sorted(totals.items(),key=lambda kv:(-kv[1],kv[0].lower()))),
            "status":status,"winner":winner,"win_threshold":threshold
        })
    save(SCORES,{"updated_at":datetime.now(timezone.utc).isoformat().replace("+00:00","Z"),"matches":out})

def preview(race):
    print(f"\nRound {race['round']} · Match {race['match']} · Race {race['race']}" + (" · TIEBREAKER" if race["is_tiebreaker"] else ""))
    print("-"*92)
    print(f"{'#':>2} {'Gate':>4} {'Uma':<22} {'Trainer':<22} {'Club':<18} {'Pts':>3}")
    print("-"*92)
    for x in race["results"]:
        mark=" NPC/DQ" if x["non_scoring"] else ""
        print(f"{x['place']:>2} {str(x['gate'] or '-'):>4} {x['uma'][:22]:<22} {x['display_trainer'][:22]:<22} {(x['club'] or '-')[:18]:<18} {x['points']:>3}{mark}")
    print("-"*92)

def git_push(rid):
    for cmd in [["git","add","data","config/tournament.json","config/players.json"],["git","commit","-m",f"Publish {rid}"],["git","push"]]:
        print("+"," ".join(cmd))
        r=subprocess.run(cmd,cwd=ROOT)
        if r.returncode!=0: raise RuntimeError("Command failed: "+" ".join(cmd))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--source")
    ap.add_argument("--round",type=int,dest="round_no")
    ap.add_argument("--match",type=int,dest="match_no")
    ap.add_argument("--race",type=int,dest="race_no")
    ap.add_argument("--non-scoring",action="append",default=[],help="Trainer name whose result should not score (NPC/DQ replacement). Repeat as needed.")
    ap.add_argument("--no-confirm",action="store_true")
    ap.add_argument("--git-push",action="store_true")
    args=ap.parse_args()
    cfg=load(CFG)
    source=Path(args.source).resolve() if args.source else newest_json(expand_path(cfg["source_directory"]))
    round_no=args.round_no or int(cfg.get("current_round",1))
    match_no=args.match_no or int(cfg.get("current_match",1))
    race_no=args.race_no or int(cfg.get("next_race",1))
    race=process(source,round_no,match_no,race_no,cfg,args.non_scoring)
    preview(race)
    if not args.no_confirm and input("Publish this race? [y/N] ").strip().lower() not in {"y","yes"}:
        print("Cancelled.");return
    RACES.mkdir(parents=True,exist_ok=True)
    save(RACES/f"{race['id']}.json",race);update_manifest(race);rebuild_scores(cfg)
    if cfg.get("auto_advance_race",True) and args.race_no is None:
        cfg["next_race"]=race_no+1;save(CFG,cfg)
    print(f"Published {race['id']}.")
    if args.git_push:git_push(race["id"])

if __name__=="__main__":
    try:main()
    except KeyboardInterrupt:raise SystemExit(130)
    except Exception as e:
        print(f"ERROR: {e}",file=sys.stderr);raise SystemExit(1)
