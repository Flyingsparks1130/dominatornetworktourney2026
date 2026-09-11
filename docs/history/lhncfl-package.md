> Historical delivery notes. For the active workflow, use the [repository README](../../README.md).

# R1 — Dominion vs Dominarium

This package includes the match-draft site update and the first organizer-supplied result. It is an overlay for the existing repository, based on commit `9c407172582e9b5df9e31f23b544a9b7cc29fecf`.

## Install and record this match

1. Close the local organizer if it is running. Extract the ZIP outside your repository.
2. Copy everything inside `COPY-INTO-REPO` into your existing repo folder. Replace matching files; keep all other files and `.git`.
3. Double-click `apply_LHNCFL_result.bat` in the repo folder. It records **Dominion 22–27 Dominarium**, advances **Dominarium** to R2 against **Dominator**, and rebuilds the website data. Running it again does not duplicate the decision.
4. Open `manage_tournament.bat` for your local preview. Browse R1 → Dominion vs Dominarium. Check **Race results** and **Match draft**.
5. In GitHub Desktop, review the changes, commit with `Add Dominion vs Dominarium draft and results`, then **Push origin**.

The package does not replace `control.json`, existing race exports, tournament configuration, the homepage, shared site styles or bracket geometry. The launcher updates only the LHNCFL decision through the organizer engine and preserves other decisions and the audit trail. If an existing score or winner conflicts, it stops so the organizer can review the discrepancy. No command pushes to GitHub automatically.

The only populated matchup draft in this package is Dominion vs Dominarium. Blank drafts for other matches are deliberately omitted to preserve anything you have already filled in. Missing draft files are supported.

## Recorded outcome

| Race | Track | Dominion | Dominarium | Running total (Dominion–Dominarium) |
| --- | --- | ---: | ---: | --- |
| 1 | Nakayama 2500m | 2 | 5 | 2–5 |
| 2 | Kyoto 3200m | 3 | 4 | 5–9 |
| 3 | Tokyo 3400m | 3 | 4 | 8–13 |
| 4 | Tokyo 2000m | 4 | 3 | 12–16 |
| 5 | Hanshin 2400m | 3 | 4 | 15–20 |
| 6 | Tokyo 1600m | 5 | 2 | 20–22 |
| 7 — tiebreaker | Hanshin 2000m | 2 | 5 | **22–27** |

MVP: **@LESKBILL**, Tamamo Cross — three wins, 12 podium points. MVP attribution comes from the organizer's supplied result.

This historical match has **six standard tracks plus a tiebreaker**. The existing global rules still describe five standard races; this package preserves the supplied match record without assuming all other matches used the same race count.

## Match files

Folder: `Dominator Tournament/R1/Dominion vs Dominarium/`

| File | Contents |
| --- | --- |
| `match.json` (already in the repo) | Internal bracket ID `r1-m1` |
| `draft.json` | External match ID `LHNCFL`, both six-Uma rosters, ten Discord players, two benches, pre-bans, vetoes, six-track card and tiebreaker |
| `results.json` | Seven reported podiums and the organizer's MVP selection; the importer checks club/player/variant attribution and calculates race scores and running totals |

Track picks and vetoed maps were transcribed from the screenshots. Uma variants, Discord handles, benches, placings, final score and MVP use the supplied text. The initial random pool, snake-pick order, additional-pick phase and training dates remain unfilled because they were not provided. An enemy veto is stored under the club that made the veto, so Mihono Bourbon (Valentine) is a Dominarium veto and Maruzensky (Summer) is a Dominion veto.

Roster entries use `{"team_id":"dominion","uma":"Gold Ship","discord":"@Beep","benched":false}`. A benched Uma has `benched:true` and `discord:null`.

Reported podiums are metadata beside `match.json`, not simulated race exports. They do not create raw times, builds, replay data, or full finishing orders. The public page labels the report and explains that original exports are unavailable. A report alone does not finalize a match: the launcher or organizer must record the official decision. Report totals and exported race totals are never added together. Later official score adjustments stay separate and display a notice if they differ from the report.

The Uma Drafter page could not be opened in this session. The text and screenshots supplied by the organizer are the source; no live-page retrieval or third-party upload is claimed.

## Validation

31 engine/organizer tests cover the seven supplied scores, variant and bench validation, no double counting, protected existing decisions, idempotent application, and advancement. JavaScript rendering checks cover the report, rosters, MVP, match-specific draft, bracket advancement and empty matches. The static site build and clean-repository overlay are also checked. No browser screenshot or live deployment is claimed.
