import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from tournament_engine import build


class DominanceMatchTests(unittest.TestCase):
    def test_dominance_match_and_named_club_rosters(self):
        result = build(ROOT, write=False)
        index = result['index']
        match = next(m for m in index['matches'] if m['id'] == 'r2-m2')
        self.assertEqual(match['scores'], {'dominant-h': 22, 'dominance': 27})
        self.assertEqual(match['computed_scores'], match['reported_results']['totals'])
        self.assertEqual(match['winner_id'], 'dominance')
        self.assertEqual(len(match['races']), 7)
        self.assertEqual([r['scores'] for r in match['reported_results']['races']], [
            {'dominant-h': a, 'dominance': b} for a, b in [(3,4),(2,5),(1,6),(2,5),(5,2),(6,1),(3,4)]])
        self.assertEqual({r['display_name']: r['points'] for r in match['player_points']}, {
            'Raykini': 9, 'NakeGhostie': 8, 'Essential': 7, 'Iviers': 3, 'Bloodvvolf': 0,
            'Kitasan': 8, 'JeryDream': 6, 'Toji Fushiguro': 4, 'Bean': 3, 'Fizzle': 1})
        self.assertEqual(match['reported_results']['mvp']['display_name'], 'Raykini')
        self.assertEqual(match['reported_results']['mvp']['points'], 9)
        self.assertIsNone(match['reported_results']['external_match_id'])
        self.assertEqual({r['uma'] for r in match['draft_lineup'] if r['benched']}, {'Oguri Cap','Mejiro Ryan'})
        for r in match['races']:
            self.assertTrue(r['scoring_verified'])
            self.assertEqual(result['races'][r['id']]['replay']['status'], 'ready')
        for club, names in {
            'domineer': {'Stayk, Taco Enjoyer','Zen','JUNI','Emperor | The Radiant One','Sonic'},
            'domichill': {'arvmilla','cannibalmira','ZUnknown','muuchan','Kurotomono'}
        }.items():
            members = index['club_rosters'][club]['members']
            self.assertEqual({r['display_name'] for r in members}, names)
            self.assertTrue(all(set(r) == {'display_name'} for r in members))
        for m in index['matches']:
            for rows in m['draft_uma_actions'].values():
                for r in rows:
                    self.assertTrue((ROOT/r['portrait']).is_file())

