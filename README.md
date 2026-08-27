# The Dominator Draft 2026

Static GitHub Pages tournament site plus a one-click Windows race publisher for finished
Umamusume races archived by Uma Race Overlay.

## Tournament model

- 12 clubs.
- 5 players per club; there are no distance/style specialist roster slots.
- 2 clubs compete head-to-head in a match.
- 5 standard races.
- A random tiebreaker track is rolled before the draft.
- Each club picks 4 tracks; each club vetoes 1 opposing pick.
- Final normal match card: 5 standard tracks + the reserved tiebreaker.
- Each club pre-bans 1 Uma.
- Each club picks 5 Umas in snake order.
- Each club then bans 1 opposing selected Uma and adds 2 more picks.
- Final pool: 6 Umas per club, with 1 benched.
- 24-hour build window.
- One submitted Uma per trainer.
- Submitted build/running style is used across all selected tracks.
- Scoring: 1st = 4, 2nd = 2, 3rd = 1.
- First club to 25 points wins.
- If no winner is decided through Race 6, use the tiebreaker.
- NPC/DQ replacements cannot score. Their scoring position passes to the next eligible finisher.

## Dominator visual theme

The site uses a separate Dominator identity based on the supplied reference art:

- black / deep-maroon base
- vivid crimson accents
- antique-gold trim
- pale desaturated text accents
- gothic/serif title treatment
- angular red brush/streak treatment in the hero

The reference image itself is not required by the website.

## Frontend page map

- `index.html` — Home / event landing page.
- `rules.html` — Full Draft format and competition rules.
- `tracks.html` — Track-draft process and future random track pool.
- `bracket.html` — 12-club random opening draw, displayed as 6 head-to-head matches.
- `clubs.html` — Searchable club field.
- `club.html?id=...` — Club drilldown with five specialist trainers.
- `match.html?round=1&match=1` — One head-to-head matchup, draft state, score, and race results.
- `stats.html` — Reserved analytics page.
- `teams.html`, `team.html`, `lobby.html` — compatibility redirects from the earlier build.

## Data files

- `config/tournament.json` — current host match/race and scoring rules.
- `config/clubs.json` — the 12 clubs and their five-player rosters.
- `config/players.json` — exact in-game trainer name → club mapping.
- `config/track_pool.json` — official random track pool when available.
- `data/bracket.json` — official random opening-round pairings.
- `data/drafts.json` — per-match track/Uma draft state.
- `data/index.json` — published-race manifest.
- `data/match_scores.json` — precomputed club scores/status by match.
- `data/races/` — normalized race-result files created by the publisher.

## One-time prerequisites

- Windows
- Steam Umamusume
- Hachimi + Uma Race Overlay configured so finished races are archived
- Python 3
- Git for Windows
- This repository cloned locally

Uma Race Overlay normally archives races under:

```text
%LOCALAPPDATA%\uma_race_overlay_races
```

## Set the official opening draw

Double-click:

```text
randomize_draw.bat
```

That randomly pairs the 12 clubs into 6 head-to-head opening matches and resets the opening
draft-state files.

For a reproducible public draw:

```powershell
py scripts\randomize_draw.py --seed "official-draw-2026"
```

Do not rerun the draw once official matchup drafting has started unless you intentionally want
to reset the opening bracket.

## Configure a match for publishing

Edit `config/tournament.json`:

```json
{
  "current_round": 1,
  "current_match": 1,
  "next_race": 1
}
```

When you move to another matchup, change `current_match` and reset `next_race` to `1`.

The default live safeguards are:

```json
{
  "expected_entries": 10,
  "standard_races": 6,
  "tiebreaker_race": 7,
  "win_threshold": 25,
  "points_by_scoring_place": {
    "1": 4,
    "2": 2,
    "3": 1
  }
}
```

## Map trainers to clubs

Edit `config/players.json`.

The key must match the trainer name in the race archive exactly:

```json
{
  "ExactInGameTrainer": {
    "display_name": "Public Display Name",
    "club": "Dominator"
  }
}
```

All 10 competing trainers should be mapped before an official match is published.

## Enter the draft state

Edit `data/drafts.json` for the relevant match, for example `r1-m1`.

You can fill in:

- tiebreaker track
- four track picks per club
- one track veto per club
- final six tracks
- Uma pre-bans
- initial five Uma picks
- second bans
- two additional Uma picks
- final six-Uma pools
- benched Uma
- build deadline

The match page reads this file directly.

## Publish a race

After an official race finishes, double-click:

```text
publish_latest.bat
```

It:

1. finds the newest archived race JSON;
2. requires exactly 10 finishers by default;
3. extracts placement, Uma, trainer, gate, and finish time;
4. maps each trainer to a club;
5. awards 4 / 2 / 1 to the first three eligible finishers;
6. previews the result;
7. asks for confirmation;
8. updates `data/races/`, `data/index.json`, and `data/match_scores.json`;
9. increments `next_race`;
10. runs Git commit + push.

The raw race archive is not copied into the public repository.

### DQ / NPC scoring

To make a trainer non-scoring for one publish:

```powershell
py scripts\publish_race.py --non-scoring "ExactInGameTrainer" --git-push
```

Repeat `--non-scoring` for multiple entries.

You can also put trainer names in the `non_scoring_trainers` array in
`config/tournament.json`. The publisher then skips those entries when assigning 4 / 2 / 1,
so the points automatically pass to the next eligible finisher.

## Test with bundled sample data

```powershell
py scripts\publish_race.py --source sample\sample_raw_race.json --round 1 --match 1 --race 1
```

The script shows a preview before changing files.

## GitHub Pages

Repository → **Settings → Pages**:

1. Deploy from a branch.
2. Select `main`.
3. Select `/ (root)`.
4. Save.

`index.html` is the homepage.

## Official 12-club field

The club list is synchronized to the Dominator Network fan tracker:

- Dominator
- Dominant H
- Dominance
- Dominate
- Dominacion
- Domineer
- Dominium
- Dominion
- Domical
- Dominante
- Domicile
- DomiChill

## Bracket publication behavior

The repository ships with the bracket in `pending` state. No club matchups are displayed on
`bracket.html` until the official draw is actually run.

Running:

```text
randomize_draw.bat
```

is the action that:

1. randomizes all 12 clubs;
2. creates the six opening head-to-head matches;
3. sets `data/bracket.json` to `status: "rolled"`;
4. creates the six draft-state records;
5. makes the matchups visible on the public Bracket page.

This avoids leaking or fabricating matchups before the official draw.


## Tournament progression

1. Round 1: 12 clubs are randomly drawn into 6 head-to-head matches.
2. The 6 Round 1 winners become seeds 1–6.
3. The 6 Round 1 losers enter a 5-round redemption round robin, fielding 2 Umas each per redemption round.
4. The top 2 redemption clubs become seeds 7 and 8.
5. Quarterfinals: Seed 1 vs 4, Seed 2 vs 3, Seed 6 vs 7, Seed 5 vs 8.
6. Semifinals: 1/4 winner vs 2/3 winner; 6/7 winner vs 5/8 winner.
7. Grand Final: semifinal winners.

Actual Round 1 club matchups remain hidden until `randomize_draw.bat` is run.
