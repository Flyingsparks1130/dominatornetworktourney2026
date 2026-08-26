# Uma Race Results — GitHub Pages starter

A small, static tournament-results site plus a **one-click Windows publisher** for finished
Umamusume races archived by Uma Race Overlay.

## What it does

1. Reads the newest `.json` file from `%LOCALAPPDATA%\uma_race_overlay_races`.
2. Extracts finishing place, gate, Uma name, trainer, and finish time.
3. Applies your points table and optional team/player aliases.
4. Writes a normalized race file to `data/races/`.
5. Updates `data/index.json` and `data/standings.json`.
6. Optionally commits and pushes the update to GitHub.
7. GitHub Pages shows the new race and standings.

No server, database, API key, or JavaScript build step is required.

## 1. Prerequisites

- Windows
- Steam Umamusume
- Hachimi + [Uma Race Overlay](https://github.com/timanovdd-arch/uma-race-overlay) configured so completed races are archived
- Python 3
- Git for Windows
- A GitHub repository cloned to this folder

The publisher uses only Python's standard library.

## 2. Configure the tournament

Edit `config/tournament.json`.

Important fields:

- `name`: site title.
- `source_directory`: normally leave this as `%LOCALAPPDATA%\uma_race_overlay_races`.
- `current_round`: round currently being hosted.
- `current_lobby`: lobby currently being hosted.
- `next_race`: next race number to publish.
- `auto_advance_race`: increments `next_race` after a successful publish.
- `expected_entries`: set to a number such as `12` if you want publishing blocked unless exactly that many finishers are found. Leave `null` to disable.
- `points_by_place`: tournament points awarded to each finishing place.

Example:

```json
"points_by_place": {
  "1": 10,
  "2": 8,
  "3": 6,
  "4": 5
}
```

## 3. Optional trainer/team mapping

Edit `config/players.json`.

The key should be the exact trainer name found in the game:

```json
{
  "ExactInGameName": {
    "display_name": "Eric",
    "team": "Team A"
  }
}
```

If a trainer is not listed, their in-game trainer name is displayed unchanged.

## 4. Test without touching your live race archive

From the repo root:

```powershell
py scripts\publish_race.py --source sample\sample_raw_race.json --round 1 --lobby 1 --race 2
```

The script prints a preview and asks for confirmation.

## 5. Publish a real race

After a race finishes, double-click:

`publish_latest.bat`

The script:

- selects the newest race archive;
- refuses a file marked `running: true`;
- prints the extracted finishing order;
- asks `Publish this race? [y/N]`;
- updates the site data;
- runs `git add`, `git commit`, and `git push`.

If you prefer to inspect everything before pushing:

```powershell
py scripts\publish_race.py
```

That updates the files locally but does not run Git.

## 6. Change round or lobby

Edit:

```json
"current_round": 2,
"current_lobby": 3,
"next_race": 1
```

in `config/tournament.json`.

You can also override values for one publish:

```powershell
py scripts\publish_race.py --round 2 --lobby 3 --race 1
```

## 7. Enable GitHub Pages

In the GitHub repository:

1. Open **Settings → Pages**.
2. Choose **Deploy from a branch**.
3. Select your default branch (usually `main`).
4. Select `/ (root)`.
5. Save.

The repo's `index.html` is the site.

## 8. Data layout

Processed race:

```text
data/races/r1-l1-race1.json
```

Manifest read by the frontend:

```text
data/index.json
```

Precomputed standings:

```text
data/standings.json
```

The site itself does not calculate official tournament points. The local publisher writes the
points into every result and rebuilds standings before the commit.

## Safety against accidental uploads

The publisher deliberately requires confirmation by default. If you accidentally run a career
race before your tournament race, the preview gives you a chance to reject it.

For an additional guard, set `expected_entries` to your lobby size.

## Later upgrades

The normalized schema is intentionally simple, so you can add:

- individual trainer profile pages;
- per-Uma win rates;
- team pages;
- round/lobby filters;
- course metadata;
- stats and skill builds;
- CSV export;
- Discord webhook announcements.

The original raw race archive is **not** copied into the repository by default.
