> Historical delivery notes. For the active workflow, use the [repository README](../../README.md).

# Match drafts and score-only results

For the populated LHNCFL match, see [LHNCFL_UPDATE.md](lhncfl-package.md). The repository-review section below describes the original remote commit before this local update.

## Repository review

Reviewed commit [`9c407172582e9b5df9e31f23b544a9b7cc29fecf` — BIG Update Race Data Support](https://github.com/Flyingsparks1130/dominatornetworktourney2026/commit/9c407172582e9b5df9e31f23b544a9b7cc29fecf).

- It adds the previous 40-file tournament update. Its contents match the delivered package; the only byte differences are Windows batch-file line endings normalized by Git.
- The four-round bracket, folder importer, local organizer, and Pages workflow are installed.
- The [custom build/publish run succeeded](https://github.com/Flyingsparks1130/dominatornetworktourney2026/actions/runs/34600936404).
- The committed organizer state is still revision 0, with no scores, confirmed winners, or race exports. Round 1 has finished according to your update, but those real results have not been entered in the repo yet.
- The screenshot's shared track-pool placeholder was in `tracks.html`. It read `config/track_pool.json`, separate from matchup folders.

## What this update changes

- `tracks.html` now lists matchups and links to their individual drafts. The shared “TRACK POOL NOT LOADED YET” block is removed.
- Rules explain that the track draft belongs to each matchup and link to the matchup draft directory.
- Each match page has **Race results** and **Match draft** sections.
- A matchup's draft is read from its own `draft.json`. It never counts as a race or changes the score.
- Match draft displays the final track card, tiebreaker, team picks/vetoes, optional Uma bans/selections/bench, training dates, and that matchup's pool.
- Completed matches can show official scores without race JSON. Those cards say **Score-only result**.
- The organizer can download a draft template for the selected match and save an edited draft JSON. A historical draft can be added after a match finishes without reopening its result.

## Files inside a matchup

Example matchup folder: `Dominator Tournament/R1/Dominion vs Dominarium/`

| Relative path | Purpose |
| --- | --- |
| `match.json` | Stable bracket ID, such as `r1-m1` |
| `draft.json` | This matchup's pool, draft actions, final tracks, and optional Uma selections |
| `01 - race description/original.json` | First original race export |
| `02 - race description/original.json` | Another original race export |

The initial draft update supplied four blank templates. The LHNCFL package supplies only the populated Dominion vs Dominarium draft and preserves other local drafts. For a new matchup, use **Download blank template** in the organizer after both opponents are known; it fills the correct `match_id` automatically.

To update a draft manually, edit its `draft.json`, then rescan/rebuild or commit and push. To use the organizer, choose the match, download the template, edit it in a text editor, choose that file under **Match draft JSON**, enter a reason, and save.

## Draft JSON format

```json
{
  "schema_version": 1,
  "match_id": "r1-m1",
  "status": "pending",
  "track_pool": [],
  "track_picks": [],
  "track_vetoes": [],
  "final_tracks": [],
  "tiebreaker_track": null,
  "uma_pre_bans": [],
  "uma_picks": [],
  "uma_bans": [],
  "uma_additions": [],
  "benched_umas": [],
  "training_start": null,
  "training_deadline": null,
  "notes": ""
}
```

| Field | What to enter |
| --- | --- |
| `status` | `pending`, `in_progress`, or `locked`; independent of match result status |
| `track_pool`, `final_tracks` | Arrays of track descriptions as strings; the order of `final_tracks` is the race order |
| `tiebreaker_track` | One track-description string, or `null` when not entered |
| `track_picks`, `track_vetoes` | Arrays of `{"team_id":"dominion","track":"Your track description"}`; `team_id` is the club making the pick/veto |
| `uma_pre_bans`, `uma_picks`, `uma_bans`, `uma_additions` | Arrays of `{"team_id":"dominion","uma":"Your Uma name and variant"}`; `team_id` is the club making the action |
| `benched_umas` | The same Uma object format; `team_id` is the club benching that Uma |
| `training_start`, `training_deadline` | Date/time strings including a timezone, or `null` |
| `notes` | Optional matchup-specific notes |
| `external_match_id` | Optional source match identifier such as `LHNCFL` |
| `roster` | Optional array of `{"team_id":"dominion","uma":"Gold Ship","discord":"@Beep","benched":false}`; use a null Discord value for an unassigned bench |

Use the exact tournament club IDs shown in the organizer. The importer rejects a draft with the wrong `match_id` or an action assigned to a different matchup's club. Array order records the action order; snake-pick numbers retain the overall order across both clubs. Partial historical drafts are accepted, so absent information can remain blank.

One `draft.json` is allowed per matchup. A populated downstream draft protects its participants: it blocks changing an earlier winner, just like downstream race records. An empty draft template does not block advancement. Move affected later-round drafts and races outside the active tournament folders before correcting an earlier result.

## Entering the real results later

**Round 1, scores only:** open the organizer, choose the match, enter both official scores and a reason, save, select the winner, and confirm advancement. A race file is not required. No dummy JSON should be created.

**Round 2, scores plus JSON:** import/drop its original race exports, assign trainers to clubs, and enter the official score if needed. Calculated race totals remain available separately. Confirm the winner when ready. Draft JSON and race JSON can be added independently.

The LHNCFL supplement now contains the first Round 1 match; follow LHNCFL_UPDATE.md to apply its official score and advancement. Other results remain unentered until supplied.

## Install with GitHub Desktop

1. Extract this ZIP outside the repo.
2. Copy everything inside `COPY-INTO-REPO` into the existing repository folder and replace matching files. Keep `.git` and all other files. If you have already filled a `draft.json` locally, keep your filled version instead of the blank starter.
3. If the local organizer is running, close its terminal and relaunch `manage_tournament.bat` to load the updated backend.
4. Run `rebuild_tournament.bat` or use **Rescan folders** for a local preview, then commit and push in GitHub Desktop. GitHub Actions also rebuilds on push.

This update does not include `control.json`, `tournament.json`, homepage HTML, shared site CSS, or existing race files. Your actual tournament state remains in those existing files. The generated index is rebuilt from them rather than replaced with a blank index by this package.

Validation covers 26 importer/organizer tests, including score-only R1 advancement, R2 scores plus race JSON plus draft, per-match draft isolation, stale edits, and protection of downstream drafts. No remote commit, push, or deployment is performed by this update.
