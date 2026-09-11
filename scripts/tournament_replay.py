"""Decode recorded global horseACT simulation frames without altering source JSON.

Binary field layout adapted from Hakuraku (MIT); see THIRD_PARTY_NOTICES.md.
No motion, skill activation or finishing position is inferred from summary scores.
"""
import base64
import binascii
import io
import gzip
import math
import struct
import zlib


class ReplayError(ValueError):
    pass


def decode_replay(raw, rows):
    encoded = raw.get('simDataBase64')
    if not encoded:
        return None
    if not isinstance(encoded, str) or len(encoded) > 16_000_000:
        raise ReplayError('Simulation payload is too large or invalid.')
    try:
        compressed = base64.b64decode(encoded, validate=True)
        with gzip.GzipFile(fileobj=io.BytesIO(compressed)) as stream:
            data = stream.read(32_000_001)
    except (ValueError, OSError, EOFError, binascii.Error, zlib.error) as exc:
        raise ReplayError('Simulation payload is not valid base64/gzip.') from exc
    if len(data) > 32_000_000:
        raise ReplayError('Decompressed simulation exceeds 32 MB.')

    def unpack(fmt, offset):
        size = struct.calcsize('<' + fmt)
        if offset < 0 or offset + size > len(data):
            raise ReplayError('Truncated simulation data.')
        values = struct.unpack_from('<' + fmt, data, offset)
        if any(isinstance(v, float) and not math.isfinite(v) for v in values):
            raise ReplayError('Non-finite simulation value.')
        return values

    def padding(offset):
        size, = unpack('i', offset)
        if size < 0 or offset + 4 + size > len(data):
            raise ReplayError('Invalid simulation padding.')
        return offset + 4 + size

    header_size, version = unpack('ii', 0)
    if header_size < 4 or header_size > 4096:
        raise ReplayError('Unsupported simulation header.')
    offset = 4 + header_size
    _, count, horse_size, result_size = unpack('fiii', offset)
    if count != len(rows) or not 1 <= count <= 18 or horse_size < 12 or result_size < 31:
        raise ReplayError('Simulation runner count or layout is unsupported.')
    offset = padding(offset + 16)
    frame_count, frame_size = unpack('ii', offset)
    offset += 8
    if not 2 <= frame_count <= 20000 or frame_size < 4 + count * horse_size:
        raise ReplayError('Unsupported simulation frame layout.')
    if offset + frame_size * frame_count > len(data):
        raise ReplayError('Truncated simulation frames.')
    frames = []
    previous = -1
    for _ in range(frame_count):
        time, = unpack('f', offset)
        if time <= previous or not 0 <= time <= 3600:
            raise ReplayError('Simulation timestamps are not increasing.')
        horses = []
        for i in range(count):
            distance, lane, speed, hp, temptation, blocked = unpack('fHHHbb', offset + 4 + i * horse_size)
            if not -100 <= distance <= 20000 or lane > 10000 or blocked < -1 or blocked >= count:
                raise ReplayError('Invalid runner frame.')
            horses.append([round(distance, 5), lane / 10000, speed / 100, hp, temptation, blocked])
        frames.append({'t': time, 'r': horses})
        previous = time
        offset += frame_size
    offset = padding(offset)
    results = []
    for i in range(count):
        values = unpack('ifffBBfBif', offset)
        results.append(values)
        offset += result_size
    offset = padding(offset)
    event_count, = unpack('i', offset)
    offset += 4
    if not 0 <= event_count <= 100000:
        raise ReplayError('Invalid event count.')
    events = []
    for _ in range(event_count):
        size, = unpack('h', offset)
        offset += 2
        time, kind, nparams = unpack('fbb', offset)
        if not 0 <= nparams <= 64 or size < 6 + nparams * 4 or offset + size > len(data):
            raise ReplayError('Invalid simulation event.')
        params = list(unpack('i' * nparams, offset + 6))
        events.append({'t': time, 'type': kind, 'params': params})
        offset += size
    if offset != len(data):
        raise ReplayError('Unsupported trailing simulation layout.')
    distance = raw.get('raceCourseSet', {}).get('distance')
    if not isinstance(distance, (int, float)) or not 100 <= distance <= 10000:
        raise ReplayError('Race distance is unavailable.')
    runner_info = []
    seen = set()
    for row in rows:
        gate = row.get('gate')
        if type(gate) is not int or not 1 <= gate <= count or gate in seen:
            raise ReplayError('Runner-to-frame mapping is ambiguous.')
        seen.add(gate)
        i = gate - 1
        result = results[i]
        if result[0] + 1 != row['place'] or abs(result[9] - row['raw_seconds']) > .02:
            raise ReplayError('Simulation results do not match the exported runner identities.')
        history = [(f['t'], f['r'][i]) for f in frames]
        finish_time = result[9]
        if not history[0][0] <= finish_time <= history[-1][0]:
            raise ReplayError('Runner finish time is outside the recorded simulation.')
        before = [(t, h) for t, h in history if t <= finish_time]
        after = next(((t, h) for t, h in history if t >= finish_time), history[-1])
        t0, h0 = before[-1] if before else history[0]
        t1, h1 = after
        alpha = max(0, min(1, (finish_time - t0) / (t1 - t0))) if t1 > t0 else 0
        hp_finish = h0[3] + (h1[3] - h0[3]) * alpha
        zero = next((h[0] for t, h in history if h[3] == 0 and h[0] < distance), None)
        spurt = result[6]
        runner_info.append({'entry_id': row['entry_id'], 'frame_index': i,
            'start_delay_ms': result[3] * 1000, 'last_spurt_m': spurt if spurt >= 0 else None,
            'spurt_delay_m': max(0, spurt - distance * 2 / 3) if spurt >= 0 else None,
            'hp_start': history[0][1][3], 'hp_finish': round(hp_finish, 1),
            'hp_zero_remaining_m': round(distance - zero, 1) if zero is not None else None,
            'peak_speed_mps': max(h[2] for t, h in before),
            'skill_activations': sum(e['type'] == 3 and bool(e['params']) and e['params'][0] == i for e in events),
            'duel_events': sum(e['type'] == 5 and bool(e['params']) and e['params'][0] == i for e in events)})
    return {'schema_version': 1, 'status': 'ready', 'simulation_version': version,
        'distance_m': distance, 'duration_s': frames[-1]['t'], 'frame_count': frame_count,
        'columns': ['distance_m', 'lane_fraction', 'speed_mps', 'hp', 'temptation_mode', 'blocked_by_frame_index'],
        'frames': frames, 'runners': runner_info, 'events': events}
