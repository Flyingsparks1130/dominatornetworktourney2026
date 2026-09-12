# Awards and private rehearsal

The Stats page publishes 19 blank cards: 18 award names, with separate Asslicker honors for incidents received and time spent blocked. Bakushin is pending and excluded. The cards retain the two supplied images and three custom trophy illustrations. Club statistics remain below the cards.

## Reveal boundary

`stats.html` calls `AwardUI.publicMount()`, which reads only the tournament index and award configuration. It never calculates or fetches standings. A URL parameter or `config.reveal` cannot reveal a winner. Public cards contain placeholder names, values and runners-up. Do not commit a generated preview or standings export. The repository's raw race records remain public as before.

Generate a portable private copy, outside this repository:

```sh
node scripts/build_awards_preview.cjs ../dominator-awards-preview.html
```

Open that HTML directly in a browser. It embeds the current standings, styles, scripts, supplied art, and trophies. Refresh from live data reads the current Pages index, skill catalog and Round 2+ race documents. No authentication or secret token is needed. A failed refresh retains the saved snapshot. The local controls can preview blank cards, filter player stats, export standings, change card art for the current session, or import verified observations. Nothing in that file publishes changes. A final public reveal requires a deliberate reviewed change to the public renderer.

## Counting rules

- Performance scope starts at Round 2. Round 1 supplies only sourced DQ incidents; CallMeNeko's organizer-confirmed R1-M1 DQ is recorded separately from official scores.
- Player identity uses club ID and normalized owner name. Optional aliases explicitly reconcile name changes. Equal names on different clubs are separate identities.
- Count each distinct fielded build once per player per matchup. Its identity includes variant, five submitted stats, equipped skills and running style. Repeated races with the same build do not repeatedly add its stats or SP. The same build fielded in a later matchup counts there too. Benched/unplayed Umas do not count.
- Use submitted `results[].stats` before motivation/race bonuses. Existing `base_stats` includes a motivation multiplier and is intentionally not used for these awards.
- Finishes, points and race events accumulate per verified export. Organizer podiums only fill races without a verified export; they are never added on top of an export. Conflicting exports or missing evidence are reported.
- Professor of Performance Anxiety uses the lowest points per 1,000 fielded base stats; Nakayama Festa uses the highest. This makes the two opposing stats/points objectives one reproducible comparison. The exact formula appears in private receipts.
- Nitro uses a start delay of at least 66 ms. Rushed mode changes within a continuous nonzero interval remain one incident.
- Flyingsparks counts equipped opponent-debuff skills once per played build. Racing Spirit: Stamina, self costs, and negative personal traits are excluded. Recorded activations break a tie.
- Retired Bourbon counts only `failed_wit` outcomes from a verified lottery reconstruction with complete resolved outcomes. Failed conditions never count.
- Blocking belongs to the runner who was blocked. Continuous blocking counts once even if the blocker changes. Observed durations end at the runner's finish.
- SP uses full purchase prices, without hints. Prerequisite tiers count once, purchased inherited uniques count, and the runner's own unique does not. Negative traits are not purchased skills.
- Wheelchair requires two distinct played rounds within the R2+ performance window.
- Each card states its numeric tiebreakers. An exact unresolved tie has no assigned winner until one sourced organizer decision selects a tied contender. Other awards may be won by the same player. Runners-up show at most two actual eligible players; a category with only one contender does not invent others.

## Evidence still needed

Duel-start events do not include verified end times. Lane position changes do not directly establish metres of forward distance lost. Neck and Neck and Swing for the Fences accept verified observations but remain unavailable until all eligible race/player records have coverage. Missing data is never used as zero. A runner with explicitly zero duel starts has zero duel duration.

The local import expects a JSON object with `verified_metrics` and/or `tie_decisions`. A metric record has `race_id`, `team_id`, `player`, `metric` (`duel_seconds` or `lane_loss_m`), nonnegative numeric `value`, `verified: true`, and a nonempty `source` describing the review. Supply a complete set when replacing `verified_metrics`. A tie decision maps the award ID to `{ "player_id": "club:normalized name", "source": "Organizer decision reference" }`; only a player tied at the top can be selected. Source exports and per-race/build receipts remain available in the preview.

## Sources and checks

The full-price catalog is generated from [Hakuraku](https://github.com/ayaliz/hakuraku), pinned at revision `88015af9f6473fa4b76463b9cf217a3c79817811`, using its Umamusume database and opponent-debuff tags. Rebuild with `node scripts/build_award_catalog.cjs /path/to/umdb.json`. Native-unique identity follows this repository's existing tournament skill normalization.

The trophy illustrations were generated for this project: a sleeping clock and five stars for Nitro; an emerald question-mark light bulb, horse-ear tiara and book for Wit; a gold horse-ear crown with a rose star for the remaining awards. All share a burgundy plinth and transparent background.

Run `node tests/test_awards_client.js`. It checks purchased skill costs, self-effect classification, received blocking, clipped durations, failed wit, round/build/export deduplication, DQs, missing evidence, ties, HTML escaping, and public reveal isolation. It also reconciles all current R2+ race points. The Pages workflow runs these checks alongside the existing Python and replay suites.
