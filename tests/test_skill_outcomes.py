import copy
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'scripts'))
from tournament_engine import normalize_race
from tournament_skills import DotNetRandom, attach_skill_outcomes


class SkillOutcomeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.path = next((ROOT/'Dominator Tournament/R2/Dominance vs Dominant H/01 - Hanshin (Inner) 2200m').glob('*.json'))
        cls.raw = json.loads(cls.path.read_text())
        cls.data = normalize_race(cls.raw)

    def test_dotnet_seed_reference_sequence(self):
        rng = DotNetRandom(1)
        for expected in [0.24866858415709278, 0.11074397718102856, 0.46701067987224587]:
            self.assertAlmostEqual(rng.next(), expected, places=15)

    def test_activated_passives_and_two_distinct_failure_reasons(self):
        replay = self.data['replay']
        self.assertTrue(replay['skill_lottery']['verified'])
        row = next(r for r in self.data['results'] if r['variant_id']==106701)
        info = next(r for r in replay['runners'] if r['entry_id']==row['entry_id'])
        outcomes = info['skill_outcomes']
        self.assertEqual(len(outcomes), len(row['skills']))
        self.assertEqual(sum(v['status']=='activated' for v in outcomes.values()), 15)
        self.assertEqual(outcomes['200014']['status'], 'activated')  # Right-Handed Demon, duration -1
        self.assertEqual(outcomes['201542']['status'], 'activated')  # Green passive
        self.assertEqual(outcomes['200462']['status'], 'failed_wit')  # Ramp Up
        self.assertGreater(outcomes['200462']['roll'], outcomes['200462']['activation_chance'])
        self.assertEqual(outcomes['201591']['status'], 'failed_condition')  # Uma Stan

    def test_unverified_stream_does_not_invent_failure_reasons(self):
        replay = copy.deepcopy(self.data['replay'])
        raw = copy.deepcopy(self.raw)
        raw['randomSeed'] += 1
        attach_skill_outcomes(raw, replay)
        self.assertFalse(replay['skill_lottery']['verified'])
        statuses = {o['status'] for r in replay['runners'] for o in r['skill_outcomes'].values()}
        self.assertEqual(statuses, {'activated','unresolved'})

    def test_every_equipped_skill_has_a_local_icon_and_type(self):
        meta = json.loads((ROOT/'assets/skill-metadata.json').read_text())
        for path in (ROOT/'Dominator Tournament').rglob('*.json'):
            if not path.parent.name[:1].isdigit():
                continue
            raw = json.loads(path.read_text())
            for horse in raw.get('raceHorse', []):
                for s in horse.get('responseHorseData', {}).get('skill_array', []):
                    skill = meta[str(s['skill_id'])]
                    self.assertIn(skill['category'], {'innate','recovery','debuff','regular'})
                    self.assertTrue((ROOT/f"assets/icons/skills/{skill['icon_id']}.webp").is_file())

    def test_racing_spirit_self_hp_cost_is_not_an_opponent_debuff(self):
        meta = json.loads((ROOT/'assets/skill-metadata.json').read_text())
        for skill_id in ('210091', '210101', '210111', '210121', '210131', '210141'):
            self.assertEqual(meta[skill_id]['category'], 'regular')
        stamina = meta['210101']
        self.assertEqual(stamina['icon_id'], 20011)
        self.assertEqual(stamina['source_icon_id'], 20161)
        self.assertEqual(stamina['activate_lot'], 1)
        self.assertIn('own HP', stamina['description'])
