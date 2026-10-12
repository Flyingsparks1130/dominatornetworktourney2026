# Tournament companion connection

The site can now read the local companion's existing `dominator-tournament/v1` approved-results export. `companion.html` shows event and per-match standings, each approved heat, course conditions, scoring snapshots, approval details and void corrections. The original archive and bracket remain their own official record.

## Try it before choosing a format

1. Run the tournament companion launcher and open the operator desk at `http://127.0.0.1:27840/`.
2. Download its approved export from `http://127.0.0.1:27840/api/ops/export`. A new event may have no results and no scoring rules yet; that is supported.
3. On Windows, double-click `preview_companion.bat` in this repository. It opens a read-only preview at `http://127.0.0.1:8766/companion.html`; keep its window open while using it. On other systems, run `python scripts/companion_preview.py`. Use `--port 8767` if 8766 is already occupied.
4. Choose **Preview an export** and select the downloaded JSON. This is browser-only: it does not upload, stage or publish the file. **Return to published results** restores the site's feed.

The test export at `tests/fixtures/companion-approved.json` can be selected to exercise two demonstration matches and a void correction. Its sample points and names are test data, not tournament defaults. It is never included in the public build or counted by the archive importer.

The OBS source stays at `/overlay`. Website operations and approvals stay in the local companion; the public website does not contact localhost or hold a GitHub token. Neither Hachimi nor horseACT is changed.

## Publishing destination, when ready

The connection settings are in `config/companion.json`:

| Setting | Initial value | Purpose |
| --- | --- | --- |
| `resultsPath` | `data/companion/approved-results.json` | Relative to this site's root, including on GitHub project Pages |
| `expectedTournamentId` | `null` | Accept the first event; set this to the companion export's tournament ID when the event is finalized |
| `matchLinks` | `[]` | Optional explicit links from companion match IDs to existing archive matches |

When publication is authorized, the companion's GitHub target can be:

| Field | Value |
| --- | --- |
| Owner | `Flyingsparks1130` |
| Repository | `dominatornetworktourney2026` |
| Branch | The review branch first; `main` only when ready for live publication |
| File | `data/companion/approved-results.json` |

These values are documented, not installed into the running companion. No token is included. Approval in the desk and its separate publication confirmation remain required. The companion writes the same complete JSON snapshot this page consumes, so no format conversion is needed. A GitHub push must still pass the site's build before Pages updates. A review-branch push alone does not deploy Pages.

No fake feed is committed: the first valid publication creates the file with the real tournament ID. The companion and local staging command refuse to overwrite a feed belonging to another event. For a new event, select a new results path and update the connection settings deliberately.

## Local staging and build

Node is required for compatibility checks and the staging helper; the site remains static HTML/JS with a standard-library Python build. From the repository:

```sh
node scripts/companion_bridge.cjs validate /path/to/approved-results.json
node scripts/companion_bridge.cjs stage /path/to/approved-results.json
node scripts/companion_bridge.cjs check
node tests/test_companion.cjs
node tests/test_companion_client.cjs
python -m unittest discover -s tests -v
python scripts/tournament_engine.py site
```

Quote Windows file paths containing spaces. `stage` updates only the local configured feed; it never commits, pushes, approves races, imports a raw replay, edits scores or advances winners. Review the staged JSON diff before publishing. The CI workflow runs the same contract checks and blocks invalid results. The reader also validates before displaying a feed, so a failed fetch or invalid export is shown as an error, not zero scores.

`_site/companion.html` is included by the existing static build. The page uses relative paths so it works under the repository's GitHub Pages subdirectory. The missing initial feed is an expected “no approved results yet” state.

## Shared contract

`assets/companion-contract.js` is the executable, dependency-free v1 contract used by the browser, staging command and CI. It accepts the companion's public export, not its private state file and not raw horseACT JSON.

| Field | Meaning |
| --- | --- |
| `schema` | Exact version `dominator-tournament/v1`; unknown versions require an adapter |
| `tournament` | Stable event ID, name and scoring rules (or `null` before setup) |
| `results[]` | Approved race ID, stable match/heat IDs, heat number, track, finishers, rule snapshot, approval time/operator and source fingerprint |
| `rows[]` inside a result | Official rank, Uma name and card ID, gate, player ID/display name, optional team, finish time and awarded points |
| `standings` | Player/team totals, finish counts, entry counts and ranks, verified against the approved rows |
| `voided[]` | Corrected race ID, optional heat ID and reason; no scored rows |

V1 supports additive position points, zero points for unlisted places, and either shared ranks or countback. It does not impose a series length, qualification rule, team roster size, score threshold or bracket format. No rule is borrowed from the completed 2026 archive. Each race's points must match its approval-time rule snapshot. Current tournament tie policy ranks the totals. A future non-additive format requires a versioned adapter rather than silently changing v1.

Pending races are omitted by the companion. Duplicate races, fingerprints, approved heats, duplicate finishing positions, unresolved reviews, missing approvals, mismatched totals and incompatible event IDs are rejected. Voiding a race removes it from results on the next approved publication; the site replaces the snapshot rather than appending scores. The consumer validates consistency, but approval fields are not cryptographic signatures: publish access to the repository remains the trust boundary.

Uma card IDs are preserved for future variant artwork/name lookup. The site displays the exported name and card ID without guessing a costume name. Event-wide totals are sums across approved heats; they do not imply a match winner or tournament advancement.

## Linking the future site

Stable IDs are the connection points. A confirmed archive link can look like this:

```json
{
  "companionMatchId": "the-match-id-from-the-companion-export",
  "archiveRoundId": "R1",
  "archiveMatchId": "r1-m1"
}
```

Put it in `matchLinks` only after setting `expectedTournamentId` to that event's ID. This adds a navigation link; it does not combine score totals or mutate `control.json`. Display names and Discord names are not reliable join keys.

Future work can import schedules and rosters into the desk, add more scoring adapters, explicitly confirm bracket advancement, or link original race replays. Those require agreed formats and ID mappings. This first connection is one-way approved results from companion to website; it does not yet import website schedules or synchronize bracket edits back to the desk.
