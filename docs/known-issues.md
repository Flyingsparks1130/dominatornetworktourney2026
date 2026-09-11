# Known content inconsistencies

These are preserved explicitly rather than resolved by inventing tournament rules.

- The owner previously requested that the homepage design remain untouched. Its older wording and `config/timeline.json` still describe 12 clubs and a redemption stage, while the active bracket has 11 clubs, five quarterfinal byes and four rounds with no redemption. A future homepage content update should reconcile this without altering its approved design.
- Global rules/config describe five standard races and one pre-ban per club. The supplied LHNCFL record has six standard races plus a tiebreaker and two pre-bans per club. The match record preserves the organizer's supplied format. Confirmation is needed before applying those counts to all matches.
- Club profiles retain their older `config/clubs.json` fallback roster. Actual match lineups are stored in per-match drafts; they may differ across rounds and should not silently overwrite a club's general profile roster.
- Stats remains a placeholder. Reported podiums and raw-export details are available in the match archive.
- Repository inspection showed both the custom tournament workflow and GitHub's Pages build activity. The tracked generated index is retained so existing static paths continue to work. Any later publishing-settings cleanup should verify the selected Pages source before removing that file.
- Hakuraku's live sample upload was not verified. The supplied practice sample is not an official match. Original race export parsing is implemented; replay and skill-event graphs are not.
