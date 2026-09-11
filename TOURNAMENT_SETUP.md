Latest recorded match: see [LHNCFL_UPDATE.md](LHNCFL_UPDATE.md) for Dominion 22–27 Dominarium and installation instructions.

# Tournament update — GitHub Desktop

For the newer match-level draft JSON workflow and score-only results, read [MATCH_DRAFTS_UPDATE.md](MATCH_DRAFTS_UPDATE.md). Draft files now live inside each matchup, alongside `match.json`.

This update is prepared for `Flyingsparks1130/dominatornetworktourney2026`, based on commit `0325b61e21c82f210d4ef408987f9b61b2cbfc7d`.

## Install once

1. In GitHub Desktop, select `dominatornetworktourney2026`, fetch origin, and pull any pending changes. Keep any uncommitted work backed up before replacing matching files.
2. Choose **Repository → Show in Explorer**.
3. Extract the installation ZIP somewhere outside the repository.
4. Copy **everything inside `COPY-INTO-REPO`** into the repository folder. Choose **Replace the files in the destination** and merge folders. Include `.github` and `.gitignore`. **Keep `.git` and all other existing files. Do not delete the repo contents.**
5. Optional local preview: double-click `manage_tournament.bat`. It opens the organizer and a **Preview site** link. Python 3.10+ is required locally; the launcher explains how to install it if absent. No third-party Python packages are required. Keep its terminal window open while using the console.
6. In GitHub Desktop, review the changes, enter `Add folder-based tournament archive and organizer`, click **Commit to main**, then **Push origin**.
7. On GitHub, set **Settings → Pages → Build and deployment → Source → GitHub Actions**. The ZIP already includes the workflow; do not create another one. Then open **Actions → Build and publish tournament**. If the initial run happened before the setting changed, rerun it or use **Run workflow**.

The supplied data index already supports a first preview. Future pushes rebuild from your folders before publishing. Invalid or duplicate race files fail the build instead of publishing misleading results. GitHub Desktop handles every commit and push; none of the launchers pushes automatically.

## Your normal folder workflow

Create folders in this order:

`Dominator Tournament / R1 / Dominion vs Dominarium / 01 - 2200m Turf Left Good / original-race.json`

- `Dominator Tournament` is the tournament root.
- `R1`, `R2`, `R3`, `R4` are Round 1, quarterfinals, semifinals, and grand final. `Round 1` through `Round 4` also work.
- The matchup folder is `Club A vs Club B`. Exact club names are recognized after both opponents are known.
- The next folder is your race description. Prefix `01`, `02`, etc. to keep races in order.
- Place the unmodified race JSON inside the race-description folder.

The four currently resolved matchup folders are provided. Future rounds have a README so Git preserves those folders. Add their actual matchup folders when opponents advance.

For a stable connection to the bracket, place `match.json` directly inside the matchup folder:

```json
{"match_id": "r1-m1"}
```

That marker is supplied in the starter matchup folders. It lets you rename a folder without losing the match association. A race-description folder may contain several exports, but **every distinct export there counts as another race** once verified. Keep test runs and alternative exports outside `Dominator Tournament`. Identical race content is rejected even if renamed.

After adding files, either push them directly and let GitHub Actions index them, or open the organizer and click **Rescan folders** to review first. `rebuild_tournament.bat` also rebuilds the local index.

## Scores, elimination, and advancement

1. Open `manage_tournament.bat` and choose a match.
2. Drop files into its repo folder, then **Rescan folders**, or use the console's optional **Import a race JSON** control.
3. Under **Trainer → club assignments**, assign each runner to the correct club. Owner names are used, not the race host's name. Uncheck **Eligible** only for a non-scoring NPC/DQ replacement. Its scoring place passes down to the next eligible runner.
4. Enter a reason and save the assignments. The optional remembered mapping applies to other files in this same match. Review every file; no club is inferred from game team/ghost fields.
5. Use **Official score override** if the organizer's official totals differ from the calculated totals. **Use computed scores** clears the override.
6. Select the winner and click **Confirm winner & advance**, or advance by forfeit. This saves the winner, marks the opponent eliminated, and fills the next-round slot. Scores alone never advance a club.
7. Preview, then commit and push the saved changes with GitHub Desktop.

**Reopen match** removes its manual score and winner. Later-round decisions or race files block changing an earlier winner: work backward through later rounds and move affected race files outside the active tournament before correcting the earlier result. No loss history is erased by normal advancement.

The console binds only to your PC (`127.0.0.1`). GitHub Pages serves the public results but cannot run the Python organizer. Score edits persist in your cloned repo's `Dominator Tournament/control.json`; browser storage is not the source of truth.

## Bracket and editable files

| ID | Match |
| --- | --- |
| r1-m1 | Dominion vs Dominarium |
| r1-m2 | Domichill vs Domineer |
| r1-m3 | Dominium vs Dominante |
| r2-m1 | Dominator vs winner of r1-m1 |
| r2-m2 | Dominance vs Dominant H |
| r2-m3 | Dominacion vs winner of r1-m2 |
| r2-m4 | Winner of r1-m3 vs Dominate |
| r3-m1 | Winner of r2-m1 vs winner of r2-m2 |
| r3-m2 | Winner of r2-m3 vs winner of r2-m4 |
| r4-m1 | Winner of r3-m1 vs winner of r3-m2 |

The supplied diagram is the authority: 11 clubs, three R1 matches, five byes, four rounds, and no redemption stage. `Dominarium` and `Dominium` remain separate clubs. Dominarium's external game club ID is blank; it is not needed for scores or progression.

| File | Purpose |
| --- | --- |
| `Dominator Tournament/tournament.json` | Current participating clubs, seeds, bracket, and scoring settings |
| `Dominator Tournament/control.json` | Saved organizer decisions, assignments, and audit history; prefer editing through the console |
| `config/clubs.json` | Roster names for existing clubs; a new club can be added using its tournament slug as `id` |
| `config/timeline.json` | Existing homepage dates and labels |
| `assets/tournament.css` | New bracket, archive, and organizer styling |
| `assets/tournament.js` | New tournament navigation and rendering |
| `data/tournament-index.json`, `data/tournament-races/` | Generated output; rebuild instead of editing manually |

Old `data/bracket.json` and the old publisher config are retained but no longer control the new bracket. The old publisher launcher now rescans your tournament folders. The old draw launcher explains the new fixed bracket and does not reroll it.

## Preserved content and open details

- `index.html` and `assets/site.css` are byte-for-byte unchanged, honoring the earlier instruction to preserve the homepage. **The existing homepage therefore still says 12 clubs and mentions redemption; its existing timeline also includes redemption.** The new bracket, Rules, and Clubs pages use the supplied 11-club four-round format. Edit homepage wording and timeline when you choose to update that preserved page.
- The earlier track rules selected eight tracks and vetoed two, leaving six, while the later instruction specifies five standard races. No additional veto rule has been invented. Organizers still need to specify how the final five are chosen and how the tiebreaker winner is settled if neither reaches 25. Manual winner confirmation supports the organizer's ruling.
- The Stats page remains its existing clearly labeled placeholder. This update supplies results and builds in the race archive.

## Hakuraku reference and results handling

Your request to load the sample in Hakuraku is a **design-reference check**, not a step players or organizers must perform to publish tournament results. The tournament importer reads your original JSON directly.

The example `Mihono Bourbon-104.7022s-20260910.json` was recovered and tested locally: all ten runners remain, zero-based `finishOrder` becomes places 1–10, Mayday owns the winner, and raw/scaled times stay distinct. The practice file is not included as an official tournament result.

The browser connection failed while opening the live Hakuraku page in this packaging session. **The example was not successfully uploaded there, and its live replay/graphs were not verified.** The current package exposes finishers, owners, build stats, skill IDs, support IDs, an original-JSON download, and an optional Hakuraku link. It does not decode the replay or reproduce skill-event graphs, and it never automatically sends race files there.

## Validation

- 21 importer/organizer tests cover placement, owner attribution, NPC scoring, full bracket progression, duplicate files, score overrides, stale revisions, and local HTTP controls.
- The actual example was imported only into a temporary test copy; no practice results or organizer decisions are in the package.
- The static build and JavaScript syntax are checked locally. Windows batch commands are prepared for Windows, but were not executed in a Windows environment here.
- No changes have been committed, pushed, or deployed to your GitHub repository by the assistant. The workflow itself can only be verified on GitHub after you push it.

GitHub setup references: [Custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) and [publishing source settings](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
