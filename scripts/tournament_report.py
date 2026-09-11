"""Organizer-reported podiums. These are never treated as original race exports."""
import copy


def normalize_report(raw, match, points):
    fields = {'schema_version', 'match_id', 'external_match_id', 'source', 'mvp', 'races'}
    if not isinstance(raw, dict) or set(raw) != fields:
        raise ValueError('results.json needs schema_version, match_id, external_match_id, source, mvp and races.')
    if type(raw['schema_version']) is not int or raw['schema_version'] != 1 or raw['match_id'] != match['id']:
        raise ValueError('results.json schema or match_id does not match this folder.')
    result = copy.deepcopy(raw)

    def text(value):
        if not isinstance(value, str) or not value.strip() or len(value) > 1000:
            raise ValueError('Report text must be non-empty and at most 1000 characters.')

    text(result['source'])
    text(result['external_match_id'])
    teams = {p['id'] for p in match['participants'] if p}
    if len(teams) != 2:
        raise ValueError('Both opponents must be known for reported results.')
    draft = match.get('draft') or {}
    if draft.get('external_match_id') and draft['external_match_id'] != result['external_match_id']:
        raise ValueError('Draft and results external match IDs differ.')
    roster = draft.get('roster', [])

    def runner(row):
        if not isinstance(row, dict) or set(row) != {'team_id', 'uma', 'discord'}:
            raise ValueError('A reported runner needs team_id, uma and discord.')
        for value in row.values():
            text(value)
        if row['team_id'] not in teams:
            raise ValueError('Reported runner must belong to this match.')
        if roster and not any(not r['benched'] and all(r[k] == row[k] for k in row) for r in roster):
            raise ValueError('Reported runner must match an active drafted Uma and Discord player.')

    if result['mvp'] is not None:
        runner(result['mvp'])
    races = result['races']
    if not isinstance(races, list) or not 1 <= len(races) <= 100:
        raise ValueError('Reported results must contain 1–100 races.')
    totals = dict.fromkeys(sorted(teams), 0)
    for i, race in enumerate(races, 1):
        if not isinstance(race, dict) or set(race) != {'number', 'track', 'tiebreaker', 'podium'}:
            raise ValueError('Each reported race needs number, track, tiebreaker and podium.')
        if type(race['number']) is not int or race['number'] != i or type(race['tiebreaker']) is not bool:
            raise ValueError('Race numbers must be consecutive; tiebreaker must be a boolean.')
        if race['tiebreaker'] and i != len(races):
            raise ValueError('The tiebreaker must be the last reported race.')
        text(race['track'])
        if race['tiebreaker']:
            expected_track = draft.get('tiebreaker_track')
        else:
            final_tracks = draft.get('final_tracks', [])
            expected_track = final_tracks[i - 1] if i <= len(final_tracks) else None
        if expected_track and race['track'] != expected_track:
            raise ValueError('Reported track differs from this match’s final draft schedule.')
        if not isinstance(race['podium'], list) or len(race['podium']) != len(points):
            raise ValueError('Report one podium entry per scoring place.')
        seen = set()
        scores = dict.fromkeys(sorted(teams), 0)
        for place, row in enumerate(race['podium'], 1):
            runner(row)
            key = row['discord'].casefold()
            if key in seen:
                raise ValueError('A runner cannot occupy two podium places in the same race.')
            seen.add(key)
            row.update(place=place, points=points[place - 1])
            scores[row['team_id']] += row['points']
        for team, score in scores.items():
            totals[team] += score
        race.update(scores=scores, cumulative_scores=dict(totals))
    result['totals'] = totals
    return result
