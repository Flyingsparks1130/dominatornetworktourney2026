"""Skill outcomes from recorded activations and a verified horseACT random stream.

Wit lottery reconstruction adapted from Hakuraku (MIT), pinned in
THIRD_PARTY_NOTICES.md. Never assign a failure reason if the reconstructed
stream does not match every runner's recorded start delay bit for bit.
"""
import json
import math
import struct
from functools import lru_cache
from pathlib import Path


def f32(value):
    return struct.unpack('<f', struct.pack('<f', value))[0]


def i32(value):
    return (value + 2**31) % 2**32 - 2**31


class DotNetRandom:
    def __init__(self, seed):
        big = 2147483647
        self.seed = [0] * 56
        mj = i32(161803398 - (big if seed == -2147483648 else abs(seed)))
        self.seed[55] = mj
        mk = 1
        for i in range(1, 55):
            ii = (21*i) % 55
            self.seed[ii] = mk
            mk = i32(mj-mk)
            if mk < 0:
                mk = i32(mk+big)
            mj = self.seed[ii]
        for _ in range(4):
            for i in range(1, 56):
                self.seed[i] = i32(self.seed[i] - self.seed[1+(i+30) % 55])
                if self.seed[i] < 0:
                    self.seed[i] = i32(self.seed[i]+big)
        self.a, self.b = 0, 21

    def next(self):
        self.a = self.a+1 if self.a < 55 else 1
        self.b = self.b+1 if self.b < 55 else 1
        value = i32(self.seed[self.a]-self.seed[self.b])
        if value == 2147483647:
            value -= 1
        if value < 0:
            value += 2147483647
        self.seed[self.a] = value
        return value / 2147483647


@lru_cache(maxsize=1)
def metadata():
    return json.loads((Path(__file__).resolve().parents[1]/'assets/skill-metadata.json').read_text())


def normalized_skill(skill_id, card_id):
    if not isinstance(skill_id, int) or not isinstance(card_id, int):
        return skill_id
    text = str(card_id)
    unique = 100000 + 10000*(int(text[-2:])-1) + int(text[1:-2])*10 + 1
    return skill_id+800000 if 100000 <= skill_id < 200000 and skill_id != unique else skill_id


def attach_skill_outcomes(raw, replay):
    definitions = metadata()
    horses = sorted((h.get('responseHorseData') or {} for h in raw.get('raceHorse', [])),
                    key=lambda h: h.get('frame_order', 0))
    seed = raw.get('randomSeed')
    if (type(seed) is not int or len(horses) != len(replay['runners'])
            or [h.get('frame_order') for h in horses] != list(range(1, len(horses)+1))):
        replay['skill_lottery'] = {'verified': False}
        return
    equipped, total = [], 0
    # Each horse consumes lottery draws in the exported equipped-skill order.
    for h in horses:
        wit = h.get('wiz')
        if not isinstance(wit, (int, float)) or not math.isfinite(wit):
            replay['skill_lottery'] = {'verified': False}
            return
        wit = wit if wit <= 1200 else 1200+(wit-1200)/2
        wisdom = min(2000, max(1, wit*(1+.02*(h.get('motivation', 3)-3))))
        chance = max(20, 100-9000/wisdom)
        skills = []
        for s in h.get('skill_array', []):
            sid = s.get('skill_id')
            normalized = normalized_skill(sid, h.get('card_id'))
            definition = definitions.get(str(normalized))
            lot = bool(definition and definition['activate_lot'] == 1)
            skills.append((sid, normalized, total if lot else None, definition))
            total += lot
        equipped.append((chance, skills))
    rng = DotNetRandom(i32(seed))
    samples = [rng.next() for _ in range(2500+len(horses)+1)]
    delays = {r['frame_index']: r['start_delay_ms']/1000 for r in replay['runners']}
    modifiers = {200431: 4000, 200432: 9000, 200433: 15000}
    base = None
    for candidate in range(total, 2501):
        match = True
        for i, (chance, skills) in enumerate(equipped):
            ability = 0
            for _, sid, offset, _ in skills:
                if sid in modifiers and offset is not None and f32(100*f32(samples[candidate-total+offset])) < chance:
                    ability = f32(modifiers[sid]/10000-1)
            expected = f32(f32(f32(.1)*f32(samples[candidate+i])) * f32(1+ability))
            if struct.pack('<f', expected) != struct.pack('<f', delays[i]):
                match = False
                break
        if match:
            base = candidate
            break
    replay['skill_lottery'] = {'verified': base is not None}
    if base is not None:
        replay['skill_lottery']['measured_base'] = base
    for runner in replay['runners']:
        i = runner['frame_index']
        fired = {e['params'][1] for e in replay['events'] if e['type'] == 3
                 and len(e['params']) > 1 and e['params'][0] == i}
        chance, skills = equipped[i]
        outcomes = {}
        for sid, normalized, offset, definition in skills:
            outcome = {'replay_skill_id': normalized, 'status': 'unresolved'}
            if sid in fired or normalized in fired:
                outcome['status'] = 'activated'
            elif base is not None and definition:
                if offset is None:
                    outcome['status'] = 'failed_condition'
                else:
                    roll = f32(100*f32(samples[base-total+offset]))
                    outcome.update(status='failed_wit' if roll >= chance else 'failed_condition',
                                   roll=round(roll, 4), activation_chance=round(chance, 4))
            outcomes[str(sid)] = outcome
        runner['skill_outcomes'] = outcomes
