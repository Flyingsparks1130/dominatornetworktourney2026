# Match updates from R2 onward

All four quarterfinals have stable IDs and their own folders under `Dominator Tournament/R2/`:

| ID | Match |
| --- | --- |
| r2-m1 | Dominator vs Dominarium |
| r2-m2 | Dominance vs Dominant H |
| r2-m3 | Dominacion vs Domineer |
| r2-m4 | Dominium vs Dominate |

The organizer can supply one race at a time, including its original race.json and reported placings, followed by the overall match result. Direct repository updates remain the delivery workflow.

- Preserve the original export bytes inside a numbered race-description subfolder. Multiple exports need distinct names; duplicate content is rejected by the importer.
- Keep the matchup's draft in draft.json and reported podiums in results.json. A partial reported record can contain only the completed races; leave MVP null until supplied. Do not invent unplayed races.
- Map exported runners to the correct clubs before using their calculated scores. Discord mentions and game owner names are not interchangeable without organizer verification.
- The report and the raw export describe the same race. Their points are never added together. The public view exposes both sources.
- Record the overall score and winner through the organizer engine only when supplied and verified. Importing one race never advances a team automatically.
- A full card contains six standard tracks plus one reserved tiebreaker. Stop racing when a team reaches 25; the unplayed remainder remains part of the draft, not the results.

Round 2 currently has no reported races, official scores or winners. The prepared folders are templates, not match outcomes.
