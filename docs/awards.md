# Awards and private rehearsal

The Stats page displays 21 awards in a trophy cabinet. Each equal-size bay shows a generated trophy and a name plaque. Hover or keyboard focus previews the organizer’s artwork without cropping. Click or tap opens a native dialog with the full image, description, counting rule and hidden winner fields. Escape, the close button or clicking the backdrop closes the dialog and restores focus. The cabinet adapts from four columns to three and two; club statistics remain below it. Asslicker counts incidents received; Agnes Digital counts time spent blocked. Bakushin is pending and excluded. All 21 awards use organizer-supplied artwork, with original GIF bytes retained.

The sections and cards appear in this order:

- Tournament Honors: MVP, The Wheelchair, Hard Carry, Crying NTR, Force of Nature, Gate Kept (Falcon).
- Build & Strategy: All Star Trainer, Professor of Performance Anxiety, Hot Headed, Fine Motion Wit, The Mejiro Fund, Nakayama Festa, Flyingsparks.
- Race Moments: The 5 Nitro Incident, Double Jet, Retired Bourbon, Asslicker, Agnes Digital, The Neck and Neck, Swing for the Fences, No More Goo Goo Babies.

## Reveal boundary

`stats.html` calls `AwardUI.publicMount()`, which reads only the tournament index and award configuration. It never calculates or fetches standings. A URL parameter or `config.reveal` cannot reveal a winner. Public plaques contain no standings; the detail dialog shows placeholder winner fields. Hover and click do not fetch or calculate standings. Do not commit a generated preview or standings export. The repository's raw race records remain public as before.

Generate a portable private copy, outside this repository:

```sh
node scripts/build_awards_preview.cjs ../dominator-awards-preview.html
```

Open that HTML directly in a browser. It embeds the current standings, styles, scripts, supplied art, and trophies. Refresh from live data reads the current Pages index, skill catalog and eligible race documents. No authentication or secret token is needed. A failed refresh retains the saved snapshot. The local controls can preview the public shelf, filter player stats, export standings, or import verified observations. Single-build winners and runners-up identify their Uma and match; their receipts point directly to the selected build. The event table and race receipts include exact finish HP. Award art is curated only through the repository configuration; the page exposes no visitor-controlled image picker. Nothing in that file publishes changes. A final public reveal requires a deliberate reviewed change to the public renderer.

Add `--linked-art` for a compact review file that loads the already-public artwork from Pages instead of embedding every GIF. Its standings, scripts and styles still remain inside the local file; reading the saved results needs no standings endpoint. Artwork requires an internet connection in this mode. Category navigation stays within the private file.

## Counting rules

- Performance scope starts at Round 2. Round 1 supplies only sourced DQ incidents; CallMeNeko's organizer-confirmed R1-M1 DQ is recorded separately from official scores.
- Player identity uses club ID and normalized owner name. Optional aliases explicitly reconcile name changes. Equal names on different clubs are separate identities.
- Count each distinct fielded build once per player per matchup. Its identity includes variant, five submitted stats, equipped skills and running style. Repeated races with the same build do not repeatedly add its stats or SP. The same build fielded in a later matchup counts there too. Benched/unplayed Umas do not count.
- All Star Trainer, Hot Headed, Fine Motion Wit and Mejiro Fund compare **individual fielded Uma builds**, not accumulated player totals. Each player enters their highest combined stats, highest Guts, lowest Wit or highest full-price SP, respectively. The winning entry carries that specific Uma/build and source export. Additional builds, races and rounds add nothing, and equal values stay tied without participation-based tiebreakers. Aggregate build totals remain available only for the unchanged Performance Anxiety / Nakayama Festa efficiency formulas and receipts.
- No More Goo Goo Babies counts each eligible runner finishing at **exactly 0 HP**, once per runner per verified race, summed by player. Interpolate raw replay-frame HP at that runner’s exact finish, before display rounding. Small positive HP, zero HP only earlier in the race, and HP exhausted after finishing do not count. Missing frame coverage leaves the award unavailable. With no zero-HP finishes it stays pending; equal positive totals remain tied.
- Use submitted `results[].stats` before motivation/race bonuses. Existing `base_stats` includes a motivation multiplier and is intentionally not used for these awards.
- Finishes, points and race events accumulate per verified export. Organizer podiums only fill races without a verified export; they are never added on top of an export. Conflicting exports or missing evidence are reported.
- Professor of Performance Anxiety uses the lowest points per 1,000 fielded base stats; Nakayama Festa uses the highest. This makes the two opposing stats/points objectives one reproducible comparison. The exact formula appears in private receipts.
- Nitro uses a start delay of at least 66 ms. Rushed mode changes within a continuous nonzero interval remain one incident.
- Flyingsparks counts recorded opponent-debuff skill activations across eligible races, up to each runner’s finish. Every repeat activation counts; equipped skills that never activate contribute nothing. Racing Spirit: Stamina, self costs, and negative personal traits are excluded. Race receipts show activation totals. Missing replay/event evidence keeps the award unavailable, and equal totals require a sourced organizer decision.
- Retired Bourbon counts only `failed_wit` outcomes from a verified lottery reconstruction with complete resolved outcomes. Failed conditions never count.
- Blocking belongs to the runner who was blocked. Continuous blocking counts once even if the blocker changes. Observed durations end at the runner's finish.
- SP uses full purchase prices, without hints. Prerequisite tiers count once, purchased inherited uniques count, and the runner's own unique does not. Negative traits are not purchased skills.
- MVP and Wheelchair both require two distinct played rounds within the R2+ performance window. MVP ranks most points, then more points per race, then fewer starts; Wheelchair ranks fewest points, then fewer points per race, then more starts. Both stay pending until someone qualifies.
- Each card states its numeric tiebreakers. An exact unresolved tie has no assigned winner until one sourced organizer decision selects a tied contender. Other awards may be won by the same player. Runners-up show at most two actual eligible players; a category with only one contender does not invent others.

## Duel and WT estimates

The private preview calculates both metrics automatically, including live refresh. All 33 current R2 and R3 exports (330 runner starts) have coverage. The public page still loads only the catalog and index; the estimates and standings are not mounted there.

- **Neck and Neck:** the pinned Hakuraku `computeOtherEvents` implementation, with its speed and skill helpers, reconstructs duel intervals from COMPETE_FIGHT events (type 5). It ends them at the runner’s finish, HP below 5% of starting HP, separation of at least 5 metres from all current/former duelers, or the upstream skill-adjusted speed expiry check. That check accounts for uphill penalties, four-second recovery grace, later speed recovery, downhill effects, and full-spurt HP. Spot Struggle (type 4) is excluded. Duplicate overlapping notifications count each runner-second once. A player’s multiple runners are summed.
- **Swing for the Fences:** use Hakuraku’s WT total, not raw lane displacement. For each consecutive frame pair, add `max(0, min(previous_speed, current_speed) * dt - max(0, current_distance - previous_distance))`. Our speeds are already metres/second. Interpolate the cumulative loss at the runner’s exact finish. This covers lane changes and wider cornering. Track geometry affects Hakuraku’s separate world/course ratio visualization, but is not an input to its total-loss formula.
- Both are **estimates**, as in Hakuraku’s own UI. Private receipts label them and retain the source revision. Input races remain untouched. The normalized replay includes the relevant existing response stats, aptitudes, mood, skills, and fan count for the full duel calculation.
- Missing frames, unsupported course data, or missing duel-analysis inputs leave coverage unavailable; they never silently become zero. No recorded duel starts gives a known zero. Sourced verified observations take precedence over calculated estimates.

The generator requires Node 24 and the pinned source revision, and needs no npm dependencies:

```sh
node scripts/build_award_telemetry.cjs /path/to/hakuraku
```

It writes the standalone JavaScript implementation and the small skill/course data subset. The website remains plain HTML/JavaScript with the standard-library Python importer. The generated implementation retains the upstream formulas; only imports, TypeScript syntax, unused analysis exports, and the full-character rank-scoring wrapper are omitted.

The local import expects a JSON object with `verified_metrics` and/or `tie_decisions`. A metric record has `race_id`, `team_id`, `player`, `metric` (`duel_seconds` or `lane_loss_m`), nonnegative numeric `value`, `verified: true`, and a nonempty `source` describing the review. Supply a complete set when replacing `verified_metrics`. A tie decision maps the award ID to `{ "player_id": "club:normalized name", "source": "Organizer decision reference" }`; only a player tied at the top can be selected. Source exports and per-race/build receipts remain available in the preview.

## Sources and checks

The full-price catalog is generated from [Hakuraku](https://github.com/ayaliz/hakuraku), pinned at revision `88015af9f6473fa4b76463b9cf217a3c79817811`, using its Umamusume database and opponent-debuff tags. Rebuild with `node scripts/build_award_catalog.cjs /path/to/umdb.json`. Native-unique identity follows this repository's existing tournament skill normalization.

Every award now has its own trophy illustration. Nitro retains its sleeping clock and five stars; Fine Motion retains its emerald question-mark bulb, tiara and book. The other 19 awards use individually generated motifs, with shared gold detailing and burgundy plinths. `config.trophies` assigns the custom assets; award GIFs remain separate for hover previews and detail dialogs. The new PNGs use plain black backgrounds blended into the dark cabinet with CSS; the two original trophies retain their alpha transparency. The private generator uses the same catalog, so embedded and linked-art review copies show the complete custom set.

Run `node tests/test_awards_client.js` and `node tests/test_award_telemetry.js`. It checks single-build rankings without accumulated-round bias, exact finish HP without rounding false positives, purchased skill costs, self-effect classification, received blocking, clipped durations, failed wit, round/build/export deduplication, DQs, missing evidence, ties, HTML escaping, and public reveal isolation. It also reconciles all current R2+ race points. Telemetry checks cover WT integration and finish interpolation, acceleration, missing inputs, duel expiry by HP/gap/speed, overlap deduplication, and all current runner estimates. The Pages workflow runs these checks alongside the existing Python and replay suites.
