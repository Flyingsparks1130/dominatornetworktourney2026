# Native race analysis

Open a match, choose a played race, then open its race export. The page contains:

1. A finishing table with character portraits, trainer and club, raw/scaled times, style and mood, start delay, last-spurt distance, finish HP, recorded duel triggers, peak speed, skill activations, build stats and points. Expand a runner to inspect named skills, IDs and support IDs.
2. An animated replay with play/pause, speed selection, seeking, exact recorded-frame stepping, runner highlighting, and pack/full-distance views.
3. A positioning table synchronized to the replay, including distance, gap, speed, HP, lane, blocking and recent skills.

The original JSON remains downloadable. Processing and playback do not upload anything to Hakuraku or require an external analysis service.

## Recorded data

`scripts/tournament_replay.py` decodes the compressed `simDataBase64` payload in supported global horseACT exports. Frame identity comes from `responseHorseData.frame_order`, validated against the simulation's final order and raw finish times. Duplicate characters remain separate runners. Playback interpolates recorded position, speed and HP between samples; it does not invent a simulation from scores. Discrete blocking/temptation flags use the nearest recorded sample. The live table preserves the official order once runners finish.

The build adds replay data to each generated `data/tournament-races/*.json`. No extra manual step is needed when adding supported race exports. Score-only R1 reports continue to have no replay. Unplayed tracks do not gain fabricated files or results. Missing, corrupt or unsupported simulation layouts retain their finishing table and show a replay-unavailable explanation.

## Measurement limits

- Start delay and last-spurt distance come directly from simulation results. Spurt delay is the distance beyond two-thirds of the course.
- Finish HP is interpolated at that runner's raw finish time. Empty-HP distance is the first recorded zero-HP sample before the finish; it is not a modeled HP deficit.
- Peak speed is the highest recorded pre-finish sample, not a modeled spurt target speed.
- Duel events are trigger counts; their duration is not supplied by these events.
- Skill labels show activations in the preceding two seconds, not active skill duration. Unknown skills retain their numeric IDs.
- Hakuraku's estimated downhill, pace and wit-lottery metrics and separate individual skill-analysis graphs are not reproduced.
- Raw course-condition names are shown as exported; the per-match draft preserves the organizer's schedule wording.

The decoder and asset attributions are in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). Character portraits are bundled for the ten variants currently raced. Future variants retain their gate number if no portrait is bundled.

## Validation

Run the Python tests, rebuild the site, then run `node tests/test_replay_client.js`. Checks cover real Kyoto measurements, identity mapping, malformed payloads, each recorded frame, interpolation, playback boundaries and all five finishing orders. The GitHub workflow runs these checks before deployment. These are automated data/playback checks, not a visual browser test.
