#!/usr/bin/env python3
"""Folder-based tournament indexer and organizer controls. Standard library only.

The original race JSON files are never edited. Tournament decisions are persisted
separately in control.json, with optimistic revisions and an audit log.
"""
from __future__ import annotations
import argparse
import collections
import copy
import hashlib
import json
import math
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from tournament_draft import normalize_draft, has_content as draft_has_content
from tournament_report import normalize_report
from tournament_replay import decode_replay, ReplayError
from tournament_participants import attach_participants

ARCHIVE = 'Dominator Tournament'
MAX_BYTES = 20 * 1024 * 1024

class TournamentError(ValueError):
    pass


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def read_json(path: Path) -> Any:
    if path.is_symlink():
        raise TournamentError(f'Symbolic links are not accepted: {path.name}')
    if path.stat().st_size > MAX_BYTES:
        raise TournamentError(f'JSON exceeds the {MAX_BYTES // 1024 // 1024} MB limit: {path.name}')
    try:
        return json.loads(path.read_text(encoding='utf-8-sig'), parse_constant=lambda x: (_ for _ in ()).throw(TournamentError(f'Non-finite JSON number: {x}')))
    except (ValueError, UnicodeError, RecursionError) as exc:
        raise TournamentError(f'Invalid JSON in {path.name}: {exc}') from exc


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    tmp.replace(path)


def digest(data: Any) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def natural(value: str) -> list:
    return [int(p) if p.isdigit() else p.casefold() for p in re.split(r'(\d+)', value)]


def safe_part(value: str) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > 160:
        raise TournamentError('Folder/file names must be non-empty and at most 160 characters.')
    if value in ('.', '..') or value.endswith((' ', '.')) or re.search(r'[<>:"/\\|?*\x00-\x1f]', value):
        raise TournamentError(f'Unsafe folder/file name: {value!r}')
    if value.split('.')[0].upper() in {'CON','PRN','AUX','NUL',*[f'COM{i}' for i in range(1,10)],*[f'LPT{i}' for i in range(1,10)]}:
        raise TournamentError('Reserved Windows filename.')
    return value


def number(value: Any, label: str, integer=False, optional=False) -> int | float | None:
    if optional and value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
        raise TournamentError(f'{label} must be a finite non-negative number.')
    if integer and value != int(value):
        raise TournamentError(f'{label} must be an integer.')
    return int(value) if integer else float(value)


def time_display(seconds: float | None) -> str | None:
    if seconds is None:
        return None
    millis = round(seconds * 1000)
    minute, remainder = divmod(millis, 60000)
    sec, ms = divmod(remainder, 1000)
    return f'{minute}:{sec:02d}.{ms:03d}'


def normalize_race(raw: dict) -> dict:
    if not isinstance(raw, dict):
        raise TournamentError('A race export must be a JSON object.')
    act = isinstance(raw.get('raceHorse'), list)
    overlay = isinstance(raw.get('horses'), list)
    if not act and not overlay:
        raise TournamentError('Unsupported race schema. Expected horseACT raceHorse[] or overlay horses[].')
    if raw.get('running') is True:
        raise TournamentError('The export says the race is still running.')
    horses = raw['raceHorse'] if act else raw['horses']
    if not horses:
        raise TournamentError('There are no runners in this export.')
    results = []
    for i, h in enumerate(horses):
        if not isinstance(h, dict):
            raise TournamentError(f'Runner {i + 1} is not an object.')
        response = h.get('responseHorseData') or {}
        trained = h.get('trainedCharaData') or {}
        params = h.get('raceParam') or {}
        if act:
            source_place = number(h.get('finishOrder'), 'finishOrder', integer=True)
            place = source_place + 1  # horseACT is zero-based; do not drop the winner.
            entry = str(number(h.get('horseIndex'), 'horseIndex', integer=True))
            owner = response.get('owner_trainer_name') or h.get('trainerName') or ''
            host = response.get('trainer_name')
            gate = response.get('frame_order')
            raw_time = number(h.get('finishTimeRaw'), 'finishTimeRaw', optional=True)
            scaled = number(h.get('finishTimeScaled'), 'finishTimeScaled', optional=True)
            skills = response.get('skill_array') or []
            support = trained.get('supportCardArray') or []
            stats = {k: number(params.get(a, trained.get(b)), k, integer=True, optional=True) for k,a,b in [
                ('speed','rawSpeed','speed'),('stamina','rawStamina','stamina'),('power','rawPow','power'),('guts','rawGuts','guts'),('wisdom','rawWiz','wiz')]}
            style = response.get('running_style', trained.get('runningStyle'))
            uma = h.get('charaName') or f"Character {h.get('charaId', '?')}"
            variant = response.get('card_id', trained.get('cardId'))
            aptitude = {'distance': h.get('activeProperDistance'), 'surface': h.get('activeProperGroundType')}
            for key, suffix in [('turf','ground_turf'),('dirt','ground_dirt'),('sprint','distance_short'),('mile','distance_mile'),('medium','distance_middle'),('long','distance_long'),('front','running_style_nige'),('pace','running_style_senko'),('late','running_style_sashi'),('end','running_style_oikomi')]:
                value = response.get('proper_' + suffix)
                if value is None:
                    value = trained.get('proper' + ''.join(part.title() for part in suffix.split('_')))
                aptitude[key] = {1:'G',2:'F',3:'E',4:'D',5:'C',6:'B',7:'A',8:'S'}.get(value)
        else:
            if h.get('finished') is False:
                raise TournamentError('A runner has not finished.')
            place = number(h.get('order'), 'order', integer=True)
            entry = str(number(h.get('gate', i + 1), 'gate', integer=True))
            owner = h.get('trainer') or ''
            host = None
            gate = h.get('gate')
            raw_time = number(h.get('finish_time'), 'finish_time', optional=True)
            scaled = None
            skills, support, stats, style, variant, aptitude = [], [], {}, None, None, {}
            uma = h.get('name') or 'Unknown Uma'
        if not isinstance(owner, str) or not isinstance(uma, str):
            raise TournamentError('Trainer and Uma names must be strings.')
        if raw_time is not None and raw_time == 0:
            raise TournamentError('A runner has a zero finish time; this may not be a completed race.')
        rowskills = [{'id': s.get('skill_id'), 'level': s.get('level')} for s in skills if isinstance(s, dict)]
        rowsupport = [{'id': s.get('supportCardId'), 'limit_breaks': s.get('limitBreakCount')} for s in support if isinstance(s, dict)]
        identity = {'owner': owner, 'variant_id': variant, 'stats': stats, 'style': style, 'skills': rowskills, 'support': rowsupport}
        results.append({'entry_id': entry, 'place': place, 'uma': uma, 'owner': owner, 'capture_trainer': host,
            'gate': gate, 'post_number': h.get('postNumber'), 'variant_id': variant, 'raw_seconds': raw_time,
            'scaled_seconds': scaled, 'raw_display': time_display(raw_time), 'scaled_display': time_display(scaled),
            'stats': stats, 'running_style_code': style, 'aptitudes': aptitude, 'skills': rowskills, 'support': rowsupport,
            'training_score': trained.get('rankScore'), 'training_rank': trained.get('rank', response.get('final_grade')),
            'build_fingerprint': digest(identity), 'is_ghost': bool(h.get('isGhost', False)),
            'mood': params.get('motivation') if act else None,
            'base_stats': {k: number(params.get(a), k, optional=True) for k,a in
                [('speed','baseSpeed'),('stamina','baseStamina'),('power','basePow'),('guts','baseGuts'),('wisdom','baseWiz')]}})
    n = len(results)
    if sorted(r['place'] for r in results) != list(range(1, n + 1)):
        raise TournamentError('Finishing places are not a complete unique sequence. No runner was silently dropped.')
    if len({r['entry_id'] for r in results}) != n:
        raise TournamentError('Duplicate runner IDs.')
    if act and raw.get('numRaceHorses') != n:
        raise TournamentError('numRaceHorses does not match raceHorse length.')
    course = raw.get('raceCourseSet') or {}
    results.sort(key=lambda r: r['place'])
    try:
        replay = decode_replay(raw, results)
    except ReplayError as exc:
        replay = {'status': 'unavailable', 'reason': str(exc)}
    return {'schema': 'horseACT' if act else 'uma-race-overlay', 'export_version': raw.get('horseACT_version'),
        'runner_count': n, 'race_type': raw.get('raceType'), 'content_hash': digest(raw),
        'course': {'course_id': course.get('id'), 'track_id': course.get('raceTrackId'), 'distance_m': course.get('distance'),
            'surface': {1:'Turf',2:'Dirt'}.get(course.get('ground'), 'Unknown'), 'turn': raw.get('rotationCategory'),
            'condition': raw.get('groundCondition'), 'weather': raw.get('weather'), 'season': raw.get('season')},
        'has_scenario': bool(raw.get('simDataBase64')), 'replay': replay, 'results': results}


def load_setup(root: Path) -> tuple[dict, dict]:
    config = read_json(root / ARCHIVE / 'tournament.json')
    control = read_json(root / ARCHIVE / 'control.json')
    teams = config.get('teams', [])
    matches = config.get('matches', [])
    rounds = config.get('rounds', [])
    tids = [t['id'] for t in teams]
    mids = [m['id'] for m in matches]
    if len(set(tids)) != len(tids) or len(set(mids)) != len(mids):
        raise TournamentError('Team and match IDs must be unique.')
    if [r['id'] for r in rounds] != ['R1','R2','R3','R4']:
        raise TournamentError('Exactly four ordered rounds R1, R2, R3, R4 are required.')
    by_id = {m['id']:m for m in matches}
    initial = []
    feeders = []
    for m in matches:
        if m['round'] not in ('R1','R2','R3','R4') or len(m['sources']) != 2:
            raise TournamentError(f"Invalid match definition: {m['id']}")
        for source in m['sources']:
            if set(source) == {'team'} and source['team'] in tids:
                initial.append(source['team'])
            elif set(source) == {'winner_of'} and source['winner_of'] in by_id:
                parent = by_id[source['winner_of']]
                if int(parent['round'][1]) != int(m['round'][1]) - 1:
                    raise TournamentError('Advancement must feed the immediately following round.')
                feeders.append(parent['id'])
            else:
                raise TournamentError(f"Invalid participant source: {source}")
    if sorted(initial) != sorted(tids) or len(set(feeders)) != len(feeders):
        raise TournamentError('Each team enters once, and each match winner advances at most once.')
    if set(feeders) != {m['id'] for m in matches if m['round'] != 'R4'} or sum(m['round']=='R4' for m in matches) != 1:
        raise TournamentError('Every non-final match must feed another match, and one final is required.')
    if not isinstance(control.get('revision'), int):
        raise TournamentError('control.json revision must be an integer.')
    return config, control


def resolve(config: dict, control: dict) -> list[dict]:
    teams = {t['id']:t for t in config['teams']}
    resolved = {}
    order = sorted(config['matches'], key=lambda m:(int(m['round'][1]),m['slot']))
    for definition in order:
        m = copy.deepcopy(definition)
        m['participants'] = []
        for src in m['sources']:
            tid = src.get('team') or resolved[src['winner_of']].get('winner_id')
            m['participants'].append(teams.get(tid))
        d = control.get('decisions', {}).get(m['id'], {})
        ids = [p['id'] for p in m['participants'] if p]
        winner = d.get('winner_id')
        if winner is not None and (len(ids)!=2 or winner not in ids):
            raise TournamentError(f"Stale or invalid winner for {m['id']}; reopen downstream decisions first.")
        manual = d.get('manual_scores')
        if manual is not None:
            if set(manual) != set(ids) or len(ids) != 2:
                raise TournamentError(f"Manual score participants are stale in {m['id']}.")
            for v in manual.values(): number(v, 'Manual score', integer=True)
        m.update(winner_id=winner, loser_id=next((i for i in ids if i!=winner),None) if winner else None,
            status=('forfeit' if d.get('method')=='forfeit' else 'complete') if winner else ('ready' if len(ids)==2 else 'awaiting_opponent'),
            manual_scores=manual, decision_reason=d.get('reason'), source='manual' if manual is not None else 'race_files')
        resolved[m['id']] = m
    return list(resolved.values())


def descendants(config: dict, mid: str) -> set[str]:
    result = set()
    todo = [mid]
    while todo:
        parent = todo.pop()
        for m in config['matches']:
            if any(s.get('winner_of') == parent for s in m['sources']) and m['id'] not in result:
                result.add(m['id']); todo.append(m['id'])
    return result


def match_folders(root: Path, config: dict, matches: list[dict]):
    base = root / ARCHIVE
    for rd in sorted(base.iterdir()):
        if rd.is_symlink(): raise TournamentError('Archive symlinks are not allowed.')
        if not rd.is_dir(): continue
        found = re.fullmatch(r'(?:r|round)[ _-]?([1-4])', rd.name, re.I)
        if not found: raise TournamentError(f'Unknown round folder {rd.name}; use R1, R2, R3, R4.')
        round_id = 'R' + found[1]
        for folder in sorted(rd.iterdir()):
            if folder.is_symlink(): raise TournamentError('Archive symlinks are not allowed.')
            if not folder.is_dir(): continue
            marker = folder / 'match.json'
            if marker.exists():
                mid = read_json(marker).get('match_id')
                possible = [m for m in matches if m['id']==mid and m['round']==round_id]
            else:
                parts = re.split(r'\s+vs\.?\s+',folder.name.strip(),flags=re.I)
                possible = []
                if len(parts)==2:
                    names = {p.casefold().strip() for p in parts}
                    for m in matches:
                        if m['round'] != round_id or not all(m['participants']): continue
                        variants = [[p['name'], *p.get('aliases',[])] for p in m['participants']]
                        if any({a.casefold(),b.casefold()}==names for a in variants[0] for b in variants[1]): possible.append(m)
            if len(possible)!=1:
                raise TournamentError(f'Cannot map {rd.name}/{folder.name} to a match. Create match.json with a valid match_id, or name it exactly X vs Y after both opponents are known.')
            yield possible[0], folder


def build(root: Path, write=True) -> dict:
    root = root.resolve()
    config, control = load_setup(root)
    matches = resolve(config, control)
    lookup = {m['id']:m for m in matches}
    race_docs = {}
    warnings = []
    content_seen = {}
    for m in matches:
        m.update(races=[], draft=None, draft_path=None, draft_has_content=False,
                 reported_results=None, report_path=None)
    for m, folder in match_folders(root, config, matches):
        draft_path = folder / 'draft.json'
        if draft_path.exists():
            if m['draft_path']:
                raise TournamentError(f"Multiple draft.json files for {m['id']}; keep one draft per matchup.")
            try:
                m['draft'] = normalize_draft(read_json(draft_path), m)
            except ValueError as exc:
                raise TournamentError(f'{draft_path.relative_to(root)}: {exc}') from exc
            m['draft_path'] = draft_path.relative_to(root).as_posix()
            m['draft_has_content'] = draft_has_content(m['draft'])
        for loose in folder.glob('*.json'):
            if loose.name not in ('match.json', 'draft.json', 'results.json'):
                raise TournamentError(f'Race JSON needs its race-description subfolder: {loose.relative_to(root)}')
        for racefolder in sorted((d for d in folder.iterdir() if d.is_dir()), key=lambda p:natural(p.name)):
            if racefolder.is_symlink(): raise TournamentError('Archive symlinks are not allowed.')
            for f in sorted(racefolder.iterdir(),key=lambda p:natural(p.name)):
                if f.is_symlink() or f.is_dir(): raise TournamentError('Only original JSON files (and optional notes) belong inside a race folder; no nested directories or links.')
                if f.suffix.lower()!='.json': continue
                raw = read_json(f)
                race = normalize_race(raw)
                source = f.relative_to(root).as_posix()
                if race['content_hash'] in content_seen:
                    raise TournamentError(f'Duplicate race: {source} duplicates {content_seen[race["content_hash"]]}. Remove the duplicate or keep it outside the active tournament folders.')
                content_seen[race['content_hash']] = source
                rid = race['content_hash'][:20]
                overrides = control.get('race_overrides',{}).get(rid,{})
                map_by_owner = control.get('roster',{}).get(m['id'],{})
                participants = {p['id'] for p in m['participants'] if p}
                reasons = []
                if len(participants)!=2: reasons.append('Both opponents must be finalized before this race can be scored.')
                if race['runner_count'] != config['scoring']['expected_entries']: reasons.append(f"Expected {config['scoring']['expected_entries']} runners; found {race['runner_count']}.")
                points = config['scoring']['points_by_place']
                ordinal = 0
                totals = {p:0 for p in participants}
                counts = collections.Counter()
                for row in race['results']:
                    assignment = overrides.get(row['entry_id'],{})
                    tid = assignment.get('team_id',map_by_owner.get(row['owner']))
                    eligible = assignment.get('eligible', True)
                    if not isinstance(eligible,bool): raise TournamentError('Eligibility must be true or false.')
                    if eligible: ordinal += 1
                    row.update(team_id=tid, eligible=eligible, scoring_place=ordinal if eligible else None,
                        points=points[ordinal-1] if eligible and ordinal<=len(points) else 0)
                    if tid in participants:
                        counts[tid]+=1; totals[tid]+=row['points']
                    elif eligible:
                        reasons.append(f"Map {row['owner'] or 'runner '+row['entry_id']} to one of this match's clubs.")
                if any(v>config['scoring']['players_per_team'] for v in counts.values()): reasons.append('More than five runners are assigned to one club.')
                race.update(id=rid,round=m['round'],match_id=m['id'],race_folder=racefolder.name,file_name=f.name,
                    raw_path=source,raw_sha256=hashlib.sha256(f.read_bytes()).hexdigest(),
                    scoring_verified=not reasons,review_reasons=list(dict.fromkeys(reasons)),team_points=totals if not reasons else None)
                meta={k:race[k] for k in ('id','round','match_id','race_folder','file_name','raw_path','runner_count','course','scoring_verified','review_reasons','team_points')}
                meta['data_file']=f'data/tournament-races/{rid}.json'
                m['races'].append(meta);race_docs[rid]=race
    # Read reports after all drafts, including when a match has more than one folder.
    for m, folder in match_folders(root, config, matches):
        report_path = folder / 'results.json'
        if report_path.exists():
            if m['report_path']:
                raise TournamentError(f"Multiple results.json reports for {m['id']}.")
            try:
                m['reported_results'] = normalize_report(read_json(report_path), m, config['scoring']['points_by_place'])
            except ValueError as exc:
                raise TournamentError(f'{report_path.relative_to(root)}: {exc}') from exc
            m['report_path'] = report_path.relative_to(root).as_posix()
    eliminated = set()
    for m in matches:
        m['races'].sort(key=lambda r:(natural(r['race_folder']),natural(r['file_name'])))
        pts = {p['id']:0 for p in m['participants'] if p}
        all_verified = bool(m['races']) and all(r['scoring_verified'] for r in m['races'])
        for r in m['races']:
            if r['scoring_verified']:
                for tid,v in r['team_points'].items(): pts[tid]+=v
        m['computed_scores'] = pts if all_verified else None
        m['scores'] = m['manual_scores'] if m['manual_scores'] is not None else m['computed_scores']
        m['score_only'] = not m['races'] and m['manual_scores'] is not None
        m['report_score_mismatch'] = bool(m['reported_results'] and m['scores'] is not None
                                         and m['reported_results']['totals'] != m['scores'])
        m['needs_review'] = any(not r['scoring_verified'] for r in m['races'])
        if not m['winner_id'] and m['status']=='ready' and m['races']:
            m['status'] = 'needs_review' if m['needs_review'] else 'in_progress'
        m['target_reached'] = [t for t,v in (m['computed_scores'] or {}).items() if v>=config['scoring']['target_points']]
        # No winner is ever inferred from a threshold, directory name or filename.
        if m['loser_id']: eliminated.add(m['loser_id'])
    portrait_path = root / 'assets/uma-portraits.json'
    portraits = json.loads(portrait_path.read_text(encoding='utf-8')) if portrait_path.exists() else {}
    club_rosters = attach_participants(matches, race_docs, portraits)
    final = next(m for m in matches if m['round']=='R4')
    output={'schema_version':1,'generated_at':now(),'id':config['id'],'name':config['name'],
        'published':config.get('published',False),'revision':control['revision'],'rounds':config['rounds'],
        'teams':config['teams'],'scoring':config['scoring'],'matches':matches,'warnings':warnings,
        'eliminated':sorted(eliminated),'champion_id':final['winner_id'], 'club_rosters': club_rosters}
    if write:
        target=root/'data/tournament-races';target.mkdir(parents=True,exist_ok=True)
        for rid,race in race_docs.items():write_json(target/f'{rid}.json',race)
        # Clean generated documents only, never the original race archive.
        for stale in target.glob('*.json'):
            if stale.stem not in race_docs: stale.unlink()
        write_json(root/'data/tournament-index.json',output)
    return {'index':output,'races':race_docs,'control':control}


def mutate(root: Path, payload: dict) -> dict:
    config, control = load_setup(root)
    if payload.get('revision') != control['revision']:
        raise TournamentError('This organizer page is stale. Reload before saving; no change was made.')
    reason=payload.get('reason','').strip()
    if len(reason)<3 or len(reason)>500:
        raise TournamentError('Provide an audit reason (3–500 characters).')
    mid=payload.get('match_id')
    index=build(root,write=False)['index']
    m=next((m for m in index['matches'] if m['id']==mid),None)
    if not m:raise TournamentError('Unknown match.')
    action=payload.get('action')
    old=copy.deepcopy(control)
    ids=[p['id'] for p in m['participants'] if p]
    children=descendants(config,mid)
    if action in ('advance','forfeit','reopen','record_report'):
        occupied=[x['id'] for x in index['matches'] if x['id'] in children and (x['races'] or x['draft_has_content'] or x['reported_results'] or control.get('decisions',{}).get(x['id']))]
        if action == 'record_report' and payload.get('winner_id') == m['winner_id']:
            occupied = []  # Recording evidence for an unchanged winner preserves downstream slots.
        if occupied:raise TournamentError('Downstream records exist: '+', '.join(occupied)+'. Reopen the latest rounds and relocate their race files and populated drafts before changing this winner. Nothing has been changed.')
        if action=='reopen':
            control['decisions'].pop(mid,None)
        else:
            if len(ids)!=2:raise TournamentError('Both opponents must be known.')
            winner=payload.get('winner_id')
            if winner not in ids:raise TournamentError('Winner must be a participant in this match.')
            if action == 'record_report':
                report = m['reported_results']
                if not report or payload.get('scores') != report['totals']:
                    raise TournamentError('The official scores must match this reported result.')
                if m['manual_scores'] is not None and m['manual_scores'] != report['totals']:
                    raise TournamentError('Existing official scores differ. Review this match in the organizer before changing them.')
                if m['winner_id'] and m['winner_id'] != winner:
                    raise TournamentError('Existing winner differs. Review this match in the organizer before changing it.')
            d=control['decisions'].setdefault(mid,{})
            d.update(winner_id=winner,method='advance' if action=='record_report' else action,reason=reason,decided_at=now())
            if action == 'record_report':
                d['manual_scores'] = copy.deepcopy(report['totals'])
    elif action=='score':
        if len(ids)!=2:raise TournamentError('Both opponents must be known before scores are entered.')
        scores=payload.get('scores')
        if scores is not None:
            if not isinstance(scores,dict) or set(scores)!=set(ids):raise TournamentError('Enter a score for both opponents.')
            scores={k:number(v,'Score',integer=True) for k,v in scores.items()}
        control['decisions'].setdefault(mid,{}).update(manual_scores=scores,reason=reason)
    elif action=='mapping':
        rid=payload.get('race_id')
        result=build(root,write=False)['races'].get(rid)
        if not result or result['match_id']!=mid:raise TournamentError('Race does not belong to this match.')
        assignments=payload.get('assignments',{})
        if not isinstance(assignments,dict):raise TournamentError('Invalid runner assignments.')
        valid={r['entry_id'] for r in result['results']}
        if set(assignments)!=valid:raise TournamentError('Provide one assignment for every runner.')
        clean={}
        for entry,a in assignments.items():
            tid=a.get('team_id');eligible=a.get('eligible')
            if tid not in ids and not(tid is None and eligible is False):raise TournamentError('Assign eligible runners to one of the two clubs.')
            if not isinstance(eligible,bool):raise TournamentError('Eligibility must be a boolean.')
            clean[entry]={'team_id':tid,'eligible':eligible}
        control['race_overrides'][rid]=clean
        if payload.get('remember_owners'):
            mapping=control['roster'].setdefault(mid,{})
            for r in result['results']:
                a=clean[r['entry_id']]
                if r['owner'] and a['team_id'] is not None: mapping[r['owner']]=a['team_id']
    else:raise TournamentError('Unknown organizer action.')
    control['revision']+=1
    control['audit'].append({'at':now(),'actor':'organizer','action':action,'match_id':mid,'reason':reason,
        'revision':control['revision'],'before':{k:old[k] for k in ('decisions','race_overrides','roster')},
        'after':{k:copy.deepcopy(control[k]) for k in ('decisions','race_overrides','roster')}})
    resolve(config,control)
    path=root/ARCHIVE/'control.json'
    write_json(path,control)
    try:return build(root)
    except Exception:
        write_json(path,old)
        raise


def import_race(root: Path, payload: dict) -> dict:
    config, control = load_setup(root)
    if payload.get('revision')!=control['revision']:raise TournamentError('Reload the organizer console before importing.')
    current=build(root,write=False)
    m=next((m for m in current['index']['matches'] if m['id']==payload.get('match_id')),None)
    if not m or not all(m['participants']):raise TournamentError('Choose a match with two known opponents.')
    if m['winner_id']:raise TournamentError('Reopen this completed match before importing more races.')
    raw=payload.get('race_json');normalized=normalize_race(raw)
    if any(r['content_hash']==normalized['content_hash'] for r in current['races'].values()):raise TournamentError('This race is already in the archive.')
    desc=safe_part(payload.get('race_folder',''));name=safe_part(payload.get('file_name',''))
    if not name.lower().endswith('.json'):raise TournamentError('Choose a JSON file.')
    existing=[p for mm,p in match_folders(root,config,current['index']['matches']) if mm['id']==m['id']]
    if len(existing)>1:raise TournamentError('Multiple folders for this match; consolidate them before console uploads.')
    parent=existing[0] if existing else root/ARCHIVE/m['round']/safe_part(' vs '.join(p['name'] for p in m['participants']))
    target=parent/desc/name
    if target.exists():raise TournamentError('A file with this name already exists. It was not overwritten.')
    if not target.resolve().is_relative_to((root/ARCHIVE).resolve()):raise TournamentError('Invalid destination.')
    parent.mkdir(parents=True,exist_ok=True)
    if not (parent/'match.json').exists():write_json(parent/'match.json',{'match_id':m['id']})
    # Preserve the exact input file text when supplied; otherwise save the parsed JSON.
    text=payload.get('raw_text')
    if text is not None:
        if not isinstance(text,str) or json.loads(text)!=raw:raise TournamentError('Upload text does not match the parsed race.')
        target.parent.mkdir(exist_ok=True)
        target.write_bytes(text.encode('utf-8'))
    else:write_json(target,raw)
    previous=copy.deepcopy(control)
    control['revision']+=1
    control['audit'].append({'at':now(),'actor':'organizer','action':'import','match_id':m['id'],'path':target.relative_to(root).as_posix(),'content_hash':normalized['content_hash'],'revision':control['revision']})
    write_json(root/ARCHIVE/'control.json',control)
    try:return build(root)
    except Exception:
        target.unlink(missing_ok=True);write_json(root/ARCHIVE/'control.json',previous);raise


def save_draft(root: Path, payload: dict) -> dict:
    """Save this match's draft independently of its official score or race files."""
    root = root.resolve()
    config, control = load_setup(root)
    if payload.get('revision') != control['revision']:
        raise TournamentError('This organizer page is stale. Reload before saving the draft.')
    reason = payload.get('reason', '')
    if not isinstance(reason, str) or not 3 <= len(reason.strip()) <= 500:
        raise TournamentError('Provide an audit reason (3–500 characters).')
    current = build(root, write=False)
    match = next((m for m in current['index']['matches'] if m['id'] == payload.get('match_id')), None)
    if not match or not all(match['participants']):
        raise TournamentError('Choose a match with two known opponents before saving its draft.')
    try:
        draft = normalize_draft(payload.get('draft_json'), match)
    except ValueError as exc:
        raise TournamentError(str(exc)) from exc
    raw_text = payload.get('raw_text')
    if raw_text is not None:
        if not isinstance(raw_text, str) or json.loads(raw_text.lstrip('\ufeff')) != payload['draft_json']:
            raise TournamentError('Draft upload text does not match its parsed JSON.')
        encoded = raw_text.encode('utf-8')
    else:
        encoded = (json.dumps(draft, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    if len(encoded) > MAX_BYTES:
        raise TournamentError('Draft exceeds the JSON size limit.')
    folders = [p for m,p in match_folders(root,config,current['index']['matches']) if m['id']==match['id']]
    if len(folders) > 1:
        raise TournamentError('Multiple folders for this match; consolidate them before saving its draft.')
    parent = folders[0] if folders else root/ARCHIVE/match['round']/safe_part(' vs '.join(t['name'] for t in match['participants']))
    target = parent/'draft.json'
    if target.is_symlink() or not target.resolve().is_relative_to((root/ARCHIVE).resolve()):
        raise TournamentError('Invalid draft destination.')
    previous_bytes = target.read_bytes() if target.exists() else None
    previous_control = copy.deepcopy(control)
    parent.mkdir(parents=True, exist_ok=True)
    if not (parent/'match.json').exists():
        write_json(parent/'match.json', {'match_id':match['id']})
    control['revision'] += 1
    control['audit'].append({'at':now(), 'actor':'organizer', 'action':'draft', 'match_id':match['id'],
        'reason':reason.strip(), 'revision':control['revision'], 'path':target.relative_to(root).as_posix(),
        'before_sha256':hashlib.sha256(previous_bytes).hexdigest() if previous_bytes is not None else None,
        'after_sha256':hashlib.sha256(encoded).hexdigest()})
    try:
        tmp = target.with_suffix('.json.tmp'); tmp.write_bytes(encoded); tmp.replace(target)
        write_json(root/ARCHIVE/'control.json', control)
        return build(root)
    except Exception:
        if previous_bytes is None: target.unlink(missing_ok=True)
        else: target.write_bytes(previous_bytes)
        write_json(root/ARCHIVE/'control.json', previous_control)
        raise


def make_site(root: Path, destination: Path) -> None:
    if destination.resolve().parent!=root.resolve() or destination.name!='_site':raise TournamentError('Site output must be the repo-root _site folder.')
    build(root)
    if destination.exists():shutil.rmtree(destination)
    destination.mkdir()
    for p in root.glob('*.html'):shutil.copy2(p,destination/p.name)
    for name in ('assets','config','data',ARCHIVE):
        if (root/name).exists():shutil.copytree(root/name,destination/name,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
    (destination/'.nojekyll').touch()


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('command',choices=['build','check','site'])
    ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    args=ap.parse_args()
    if args.command=='site':make_site(args.root,args.root/'_site')
    else:
        result=build(args.root,write=args.command=='build')
        print(f"Validated {len(result['index']['matches'])} matches and {len(result['races'])} race files.")
    print('No Git commit or push has been performed.')

if __name__=='__main__':
    try:main()
    except (TournamentError,OSError,KeyError,TypeError) as exc:
        print(f'ERROR: {exc}',file=sys.stderr);raise SystemExit(1)
