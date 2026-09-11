"""Read-only display rosters; original drafts and organizer identity mappings stay intact."""
import re


def display_name(value):
    text = str(value or '').strip()
    if re.fullmatch(r'<@!?\d+>', text):
        return ''  # A Discord ID is not a known player name.
    return text.lstrip('@').strip()


def attach_participants(matches, race_docs):
    clubs = {}
    for match in matches:
        draft = (match.get('draft') or {}).get('roster', [])
        verified = [race_docs[r['id']] for r in match['races'] if r['scoring_verified']]
        if verified:
            lineup = [{'team_id': r['team_id'], 'uma': r['uma'], 'variant_id': r['variant_id'],
                       'display_name': display_name(r['owner']), 'benched': False}
                      for r in sorted(verified[-1]['results'], key=lambda r: (r['team_id'] or '', r['owner'].casefold()))
                      if r['eligible'] and r['team_id']]
            lineup += [{**r, 'display_name': ''} for r in draft if r['benched']]
        else:
            lineup = [{**r, 'display_name': display_name(r.get('discord'))} for r in draft]
        match['lineup'] = lineup
        match['lineup_source'] = 'race' if verified else 'draft'
        report = match.get('reported_results')
        if report:
            for reported in report['races']:
                exports = [r for r in verified if re.match(r'^(\d+)\s*-', r['race_folder'])
                           and int(re.match(r'^(\d+)\s*-', r['race_folder'])[1]) == reported['number']]
                for podium in reported['podium']:
                    podium['display_name'] = display_name(podium['discord'])
                    if len(exports) == 1:
                        row = next((r for r in exports[0]['results'] if r['place'] == podium['place']), None)
                        if row and row['team_id'] == podium['team_id'] and row['uma'] == re.sub(r'\s*\([^)]*\)$', '', podium['uma']):
                            podium['display_name'] = display_name(row['owner'])
            if report.get('mvp'):
                report['mvp']['display_name'] = display_name(report['mvp']['discord'])
        for team in match['participants']:
            if not team:
                continue
            members = [r for r in lineup if r['team_id'] == team['id'] and not r['benched']]
            # A future empty draft must not hide the most recent played lineup.
            if members:
                clubs[team['id']] = {'match_id': match['id'], 'round': match['round'],
                                     'source': match['lineup_source'], 'members': members}
    return clubs
