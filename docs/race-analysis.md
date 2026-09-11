# Native race analysis

Open a match and select any played race. A single-export folder opens its analysis directly; folders containing multiple runs still offer an export selector. Every race page links to the other played races in that match. The page contains:

1. A fitted finishing table with character portraits, trainer and club, raw times, style and mood, start/spurt delay, finish HP, peak speed and points. Select a runner to open the detail dialog: raw/base stats, aptitudes, named skills and activation timestamps, support IDs, raw/scaled times, other recorded metrics, phase averages and HP/speed charts.
2. An animated replay with play/pause, speed selection, seeking, exact recorded-frame stepping, runner highlighting, pack/full-distance views and skill popups beside the runners. Popups can be hidden; selecting a runner highlights its events.
3. A positioning table synchronized to the replay, including distance, gap, speed, HP, lane, blocking and recent skills.

The original JSON remains downloadable. Processing and playback do not upload anything to Hakuraku or require an external analysis service.

## Recorded data

`scripts/tournament_replay.py` decodes the compressed `simDataBase64` payload in supported global horseACT exports. Frame identity comes from `responseHorseData.frame_order`, validated against the simulation's final order and raw finish times. Duplicate characters remain separate runners. Playback interpolates recorded position, speed and HP between samples; it does not invent a simulation from scores. Discrete blocking/temptation flags use the nearest recorded sample. The live table preserves the official order once runners finish.

The build adds replay data to each generated `data/tournament-races/*.json`. No extra manual step is needed when adding supported race exports. Score-only R1 reports continue to have no replay. Unplayed tracks do not gain fabricated files or results. Missing, corrupt or unsupported simulation layouts retain their finishing table and show a replay-unavailable explanation.

## Measurement limits

- Start delay and last-spurt distance come directly from simulation results. A start delay of **66 ms or greater** is labeled Late, using the unrounded value. Spurt delay is the distance beyond two-thirds of the course.
- Finish HP is interpolated at that runner's raw finish time. Empty-HP distance is the first recorded zero-HP sample before the finish; it is not a modeled HP deficit.
- Peak speed is the highest recorded pre-finish sample, not a modeled spurt target speed.
- Duel events are trigger counts; their duration is not supplied by these events.
- Skill labels show activations in the preceding two seconds, not active skill duration. Unknown skills retain their numeric IDs.
- The dialog's phase averages weight position and speed by elapsed time within each distance section. Opening is the first sixth, middle ends at two-thirds, final covers the last third, and spurt starts at the recorded spurt point (overlapping the final phase).
- Base stats are the `raceParam.base*` values recorded in the original export, not modeled effective racing stats.
- Hakuraku's estimated downhill, pace and wit-lottery metrics and separate individual skill-analysis graphs are not reproduced.
- Raw course-condition names are shown as exported; the per-match draft preserves the organizer's schedule wording. The match and club pages display verified owner names without changing the underlying Discord references or scoring assignments.

The decoder and asset attributions are in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). Character portraits are bundled for the recorded drafts and races. `assets/uma-portraits.json` maps draft names and costume aliases to explicit card IDs and local images. Unknown variants retain a text or gate-number fallback.

Match pages show each active player's Uma and total podium points, including zero scorers. Verified exports supply the points; reported podiums fill numbered races without a verified export. The two sources are never added together for the same race. Organizer score overrides do not invent individual player points. Club pages show player names only, using the latest populated lineup.

## Validation

Run the Python tests, rebuild the site, then run `node tests/test_replay_client.js`. Checks cover real Kyoto measurements, identity mapping, malformed payloads, every imported race's recorded frames, interpolation, playback boundaries, finishing orders, the 66 ms cutoff and match contributions. The GitHub workflow runs these checks before deployment. These are automated data/playback checks, not a visual browser test.
