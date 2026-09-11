"""Checks against recorded Kyoto telemetry, plus malformed payload handling."""
import base64
import copy
import gzip
import json
import pathlib
import struct
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).parents[1] / 'scripts'))
from tournament_engine import normalize_race


class ReplayTests(unittest.TestCase):
    def setUp(self):
        self.raw = json.loads((pathlib.Path(__file__).parent / 'fixtures/replay-kyoto.json').read_text())

    def test_recorded_kyoto_results_and_reference_metrics(self):
        race = normalize_race(self.raw)
        rep = race['replay']
        self.assertEqual(rep['status'], 'ready')
        self.assertEqual(rep['frame_count'], 146)
        self.assertEqual(rep['frames'][0]['t'], 0)
        winner = next(r for r in rep['runners'] if r['entry_id'] == race['results'][0]['entry_id'])
        self.assertEqual(race['results'][0]['uma'], 'Rice Shower')
        self.assertEqual(winner['frame_index'], 3)
        self.assertAlmostEqual(winner['start_delay_ms'], 33.1236, places=3)
        self.assertAlmostEqual(winner['spurt_delay_m'], 1.558, places=3)
        self.assertAlmostEqual(winner['hp_finish'], 227.1, places=1)
        self.assertEqual(winner['skill_activations'], 17)
        self.assertTrue(any(e['type'] == 3 and e['t'] > 0 for e in rep['events']))
        self.assertTrue(all(b['t'] > a['t'] for a, b in zip(rep['frames'], rep['frames'][1:])))
        self.assertTrue(all(len(f['r']) == 10 for f in rep['frames']))
        self.assertGreater(rep['frames'][-1]['r'][3][0], 2200)

    def test_input_array_order_cannot_reassign_frames(self):
        before = normalize_race(self.raw)['replay']
        self.raw['raceHorse'].reverse()
        self.assertEqual(normalize_race(self.raw)['replay'], before)

    def test_bad_payload_keeps_summary_and_cannot_fake_replay(self):
        self.raw['simDataBase64'] = 'not base64'
        race = normalize_race(self.raw)
        self.assertEqual(race['runner_count'], 10)
        self.assertEqual(race['replay']['status'], 'unavailable')
        self.assertNotIn('frames', race['replay'])

    def test_frame_identity_mismatch_is_rejected(self):
        a,b = self.raw['raceHorse'][:2]
        a['responseHorseData']['frame_order'],b['responseHorseData']['frame_order'] = b['responseHorseData']['frame_order'],a['responseHorseData']['frame_order']
        self.assertEqual(normalize_race(self.raw)['replay']['status'], 'unavailable')

    def test_malformed_frame_count_is_rejected(self):
        data = bytearray(gzip.decompress(base64.b64decode(self.raw['simDataBase64'])))
        header_size, = struct.unpack_from('<i', data)
        off = 4 + header_size + 16
        pad, = struct.unpack_from('<i', data, off)
        struct.pack_into('<i', data, off + 4 + pad, 2_000_000_000)
        self.raw['simDataBase64'] = base64.b64encode(gzip.compress(data)).decode()
        self.assertEqual(normalize_race(self.raw)['replay']['status'], 'unavailable')

    def test_missing_simulation_has_no_replay(self):
        del self.raw['simDataBase64']
        self.assertIsNone(normalize_race(self.raw)['replay'])


if __name__ == '__main__':
    unittest.main()
