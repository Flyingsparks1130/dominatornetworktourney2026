import copy
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from tournament_engine import build
from tournament_participants import attach_participants, display_name


class ParticipantTests(unittest.TestCase):
    def test_race_owner_names_drive_match_and_club_lineups(self):
        result = build(ROOT, write=False)
        index = result['index']
        match = next(m for m in index['matches'] if m['id'] == 'r2-m4')
        expected = {'dominate': {'Reyov', 'Mayday', 'Flyingsparkz', 'BYond', 'raine'},
                    'dominium': {'Raven621', 'Mamboo', 'Yokka', 'Unluckyyy', 'Juqi'}}
        for club, names in expected.items():
            self.assertEqual({r['display_name'] for r in match['lineup'] if r['team_id'] == club and not r['benched']}, names)
            self.assertEqual({r['display_name'] for r in index['club_rosters'][club]['members']}, names)
            self.assertEqual(index['club_rosters'][club]['round'], 'R2')
        self.assertEqual(match['reported_results']['races'][1]['podium'][0]['display_name'], 'Mamboo')
        self.assertTrue(match['draft']['roster'][0]['discord'].startswith('<@'))
        self.assertEqual(len(match['races']), 5)
        self.assertTrue(all(result['races'][r['id']]['replay']['status'] == 'ready' for r in match['races']))

    def test_unverified_race_cannot_replace_draft_roster(self):
        match = {'id':'r1-m1','round':'R1','participants':[{'id':'a'},{'id':'b'}],
                 'draft':{'roster':[{'team_id':'a','uma':'Uma','discord':'@Known','benched':False}]},
                 'races':[{'id':'r','scoring_verified':False}]}
        source = copy.deepcopy(match['draft'])
        clubs = attach_participants([match], {})
        self.assertEqual(clubs['a']['members'][0]['display_name'], 'Known')
        self.assertEqual(match['draft'], source)

    def test_discord_mentions_are_not_invented_names(self):
        self.assertEqual(display_name('@Flareon'), 'Flareon')
        self.assertEqual(display_name('<@479998555290075136>'), '')
        self.assertEqual(display_name('<@!479998555290075136>'), '')
        self.assertEqual(display_name('name@club'), 'name@club')


if __name__ == '__main__':
    unittest.main()
