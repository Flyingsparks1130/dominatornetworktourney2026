"""Display rosters and contributions, without changing source exports or official scores."""
import re


def display_name(value):
    text = str(value or '').strip()
    if re.fullmatch(r'<@!?\d+>', text):
        return ''
    return text.lstrip('@').strip()


def race_number(race):
    match = re.match(r'^(\d+)\s*-', race.get('race_folder', ''))
    return int(match[1]) if match else None


def attach_participants(matches, race_docs, portraits=None):
    portraits = portraits or {}
    by_variant = {p['variant_id']: p for p in portraits.values()}
    clubs = {}
    for match in matches:
        draft = [{**r, **portraits.get(r['uma'], {})}
                 for r in (match.get('draft') or {}).get('roster', [])]
        match['draft_lineup'] = [{**r, 'display_name': r.get('display_name') or display_name(r.get('discord'))}
                                for r in draft]
        match['draft_uma_actions'] = {
            key: [{**r, **portraits.get(r['uma'], {})} for r in (match.get('draft') or {}).get(key, [])]
            for key in ('uma_pre_bans', 'uma_picks', 'uma_bans', 'uma_additions', 'benched_umas', 'uma_selections')}
        verified = [race_docs[r['id']] for r in match['races'] if r['scoring_verified']]

        def runner(row):
            selection = next((d for d in draft if not d['benched'] and d['team_id'] == row['team_id']
                              and d.get('variant_id') == row['variant_id']), {})
            return {**selection, **by_variant.get(row['variant_id'], {}),
                    'team_id': row['team_id'], 'uma': selection.get('uma', row['uma']),
                    'variant_id': row['variant_id'], 'display_name': display_name(row['owner']),
                    'benched': False}

        if verified:
            lineup = [runner(r) for r in sorted(verified[-1]['results'], key=lambda r: (r['team_id'] or '', r['owner'].casefold()))
                      if r['eligible'] and r['team_id']]
            lineup += [{**r, 'display_name': ''} for r in draft if r['benched']]
        else:
            lineup = match['draft_lineup']
        match['lineup'] = lineup
        match['lineup_source'] = 'race' if verified else 'draft'
        for selection in match['draft_lineup']:
            if selection['benched'] or selection['display_name']:
                continue
            player = next((r for r in lineup if r['team_id'] == selection['team_id']
                           and r.get('variant_id') == selection.get('variant_id')
                           and r['uma'] == selection['uma']), None)
            if player:
                selection['display_name'] = player['display_name']

        def reported_player(row):
            result = {**row, **portraits.get(row['uma'], {}),
                      'display_name': row.get('display_name') or display_name(row.get('discord'))}
            player = next((r for r in lineup if not r['benched'] and r['team_id'] == row['team_id']
                           and ((r.get('variant_id') is not None and r.get('variant_id') == result.get('variant_id'))
                                or r['uma'] == row['uma'])), None)
            if player:
                result.update(display_name=player['display_name'])
            return result

        report = match.get('reported_results')
        if report:
            for reported in report['races']:
                exports = [r for r in verified if race_number(r) == reported['number']]
                for podium in reported['podium']:
                    podium.update(reported_player(podium))
                    if len(exports) == 1:
                        row = next((r for r in exports[0]['results'] if r['place'] == podium['place']), None)
                        if row and row['team_id'] == podium['team_id'] and row['uma'] == re.sub(r'\s*\([^)]*\)$', '', podium['uma']):
                            podium.update(display_name=display_name(row['owner']), variant_id=row['variant_id'])
                            podium.update(by_variant.get(row['variant_id'], {}))
            if report.get('mvp'):
                report['mvp'].update(reported_player(report['mvp']))

        # Reports fill races with no verified export; never add them on top of JSON points.
        players = {}
        def add(player, points=0):
            key = (player['team_id'], player.get('variant_id') or player['uma'], player['display_name'])
            if key not in players:
                players[key] = {**player, 'points': 0}
            players[key]['points'] += points

        for row in lineup:
            if not row['benched']:
                add(row)
        for race in verified:
            for row in race['results']:
                if row['eligible'] and row['team_id']:
                    add(runner(row), row['points'])
        covered = {race_number(r) for r in verified}
        for race in (report or {}).get('races', []):
            if race['number'] not in covered:
                for row in race['podium']:
                    add(reported_player(row), row['points'])
        match['player_points'] = sorted(players.values(), key=lambda r: (r['team_id'], -r['points'], r['display_name'].casefold()))
        match['player_points_recorded'] = bool(verified or report)
        if report and report.get('mvp'):
            mvp = report['mvp']
            mvp['points'] = sum(r['points'] for r in players.values() if r['team_id'] == mvp['team_id']
                                and r['display_name'] == mvp['display_name']
                                and (r.get('variant_id') == mvp.get('variant_id') if mvp.get('variant_id') else r['uma'] == mvp['uma']))
        for team in match['participants']:
            if not team:
                continue
            members = [r for r in lineup if r['team_id'] == team['id'] and not r['benched']]
            if members:
                clubs[team['id']] = {'match_id': match['id'], 'round': match['round'],
                                     'source': match['lineup_source'],
                                     'members': [{'display_name': r['display_name']} for r in members]}
    return clubs
