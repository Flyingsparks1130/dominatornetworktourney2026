import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from tournament_engine import build


class FinalMatchTests(unittest.TestCase):
    def test_confirmed_championship_reconciles_six_exports(self):
        state = build(ROOT, write=False)
        index = state['index']
        final = next(m for m in index['matches'] if m['id'] == 'r4-m1')
        self.assertEqual(index['champion_id'], 'dominance')
        self.assertTrue(all(m['winner_id'] for m in index['matches']))
        self.assertEqual(len(index['eliminated']), 10)
        self.assertNotIn('dominance', index['eliminated'])
        self.assertEqual(final['scores'], {'dominance': 25, 'dominacion': 17})
        self.assertEqual(final['computed_scores'], final['scores'])
        self.assertEqual(final['reported_results']['totals'], final['scores'])
        self.assertEqual(len(final['races']), 6)
        self.assertEqual([r['team_points'] for r in final['races']], [
            {'dominance': a, 'dominacion': b} for a, b in [(4,3),(4,3),(5,2),(2,5),(7,0),(3,4)]])
        self.assertTrue(all(r['scoring_verified'] for r in final['races']))
        self.assertTrue(all(state['races'][r['id']]['replay']['status'] == 'ready' for r in final['races']))
        self.assertEqual(final['reported_results']['mvp']['display_name'], 'Essential')
        self.assertEqual(final['reported_results']['mvp']['points'], 12)
        self.assertEqual(sum(p['points'] for p in final['player_points']), 42)
        self.assertEqual({p['display_name']: p['points'] for p in final['player_points']}, {
            'Essential': 12, 'Raykini': 10, 'Bloodvvolf': 2, 'NakeGhostie': 1, 'Iviers': 0,
            'wata': 7, 'bloop': 5, 'McGee': 4, 'AngelicVixen': 1, 'Zanko': 0})
        self.assertEqual({p['uma'] for p in final['draft_lineup'] if p['benched']}, {'Maruzensky', 'Meisho Doto (Halloween)'})
        self.assertTrue(final['draft']['tiebreaker_track'].startswith('Tokyo 1400m'))
        self.assertFalse(any(r['tiebreaker'] for r in final['reported_results']['races']))
        for row in final['draft_lineup'] + final['lineup']:
            self.assertTrue((ROOT / row['portrait']).is_file())
