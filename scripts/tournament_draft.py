"""Match-scoped draft documents. No tournament result is inferred from a draft."""
import copy

STRING_LISTS = ('track_pool', 'final_tracks')
EVENT_LISTS = {
    'track_picks': 'track', 'track_vetoes': 'track',
    'uma_pre_bans': 'uma', 'uma_picks': 'uma', 'uma_bans': 'uma',
    'uma_additions': 'uma', 'benched_umas': 'uma', 'uma_selections': 'uma',
}


def blank_draft(match_id):
    return {
        'schema_version': 1, 'match_id': match_id, 'status': 'pending',
        'track_pool': [], 'track_picks': [], 'track_vetoes': [],
        'final_tracks': [], 'tiebreaker_track': None,
        'uma_pre_bans': [], 'uma_picks': [], 'uma_bans': [],
        'uma_additions': [], 'benched_umas': [], 'uma_selections': [],
        'training_start': None, 'training_deadline': None, 'notes': '',
        'external_match_id': None, 'roster': [],
    }


def has_content(draft):
    return bool(draft and (
        draft['status'] != 'pending' or draft['notes'] or draft['tiebreaker_track']
        or draft['training_start'] or draft['training_deadline']
        or draft.get('external_match_id') or draft.get('roster')
        or any(draft[k] for k in (*STRING_LISTS, *EVENT_LISTS))
    ))


def normalize_draft(raw, match):
    if not isinstance(raw, dict):
        raise ValueError('draft.json must contain a JSON object.')
    result = blank_draft(match['id'])
    unknown = set(raw) - set(result)
    if unknown:
        raise ValueError('Unknown draft field(s): ' + ', '.join(sorted(unknown)))
    if type(raw.get('schema_version', 1)) is not int or raw.get('schema_version', 1) != 1:
        raise ValueError('draft.json schema_version must be 1.')
    if raw.get('match_id') != match['id']:
        raise ValueError(f"draft.json match_id must be {match['id']} for this folder.")
    if raw.get('status', 'pending') not in ('pending', 'in_progress', 'locked'):
        raise ValueError('Draft status must be pending, in_progress, or locked.')
    result.update(copy.deepcopy(raw))
    teams = {t['id'] for t in match['participants'] if t}

    def text(value, label, optional=False, max_length=1000):
        if optional and value is None:
            return None
        if not isinstance(value, str) or len(value) > max_length or (not optional and not value.strip()):
            raise ValueError(f'{label} must be text, at most {max_length} characters.')
        return value

    for field in (*STRING_LISTS, *EVENT_LISTS):
        values = result[field]
        if not isinstance(values, list) or len(values) > 200:
            raise ValueError(f'{field} must be an array of at most 200 entries.')
        for i, value in enumerate(values):
            label = f'{field}[{i}]'
            if field in STRING_LISTS:
                text(value, label)
            else:
                key = EVENT_LISTS[field]
                if not isinstance(value, dict) or set(value) != {'team_id', key}:
                    raise ValueError(f'{label} must contain team_id and {key}.')
                if not isinstance(value['team_id'], str) or value['team_id'] not in teams:
                    raise ValueError(f'{label} must name one of this match’s two clubs.')
                text(value[key], label + '.' + key)
    for key in ('tiebreaker_track', 'training_start', 'training_deadline'):
        text(result[key], key, optional=True)
    text(result['external_match_id'], 'external_match_id', optional=True, max_length=100)
    roster = result['roster']
    if not isinstance(roster, list) or len(roster) > 12:
        raise ValueError('roster must be an array of at most 12 entries.')
    seen_umas, seen_players = set(), set()
    for row in roster:
        if not isinstance(row, dict) or set(row) - {'display_name'} != {'team_id', 'uma', 'discord', 'benched'}:
            raise ValueError('Each roster entry needs team_id, uma, discord and benched.')
        text(row['team_id'], 'roster.team_id')
        text(row['uma'], 'roster.uma')
        if 'display_name' in row:
            text(row['display_name'], 'roster.display_name')
        text(row['discord'], 'roster.discord', optional=row['benched'] is True or bool(row.get('display_name')))
        if row['team_id'] not in teams or type(row['benched']) is not bool:
            raise ValueError('Roster club must be a participant and benched must be a boolean.')
        key = (row['team_id'], row['uma'].casefold())
        player = (row['discord'] or row.get('display_name') or '').casefold()
        if key in seen_umas or (player and player in seen_players):
            raise ValueError('Duplicate roster Uma or Discord player.')
        seen_umas.add(key)
        if player:
            seen_players.add(player)
    for team in teams:
        entries = [r for r in roster if r['team_id'] == team]
        if sum(not r['benched'] for r in entries) > 5 or sum(r['benched'] for r in entries) > 1:
            raise ValueError('Each club may list up to five active Umas and one bench.')
    text(result['notes'], 'notes', optional=True, max_length=4000)
    if result['notes'] is None:
        result['notes'] = ''
    return result
