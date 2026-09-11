# Known content inconsistencies

These are preserved explicitly rather than resolved by inventing tournament rules.

- The owner confirmed six standard tracks plus a reserved tiebreaker, now reflected in rules and configuration. The old global pre-ban wording still says one per club, while all three supplied R1 drafts contain two per club; preserve the match records and confirm the global pre-ban rule before changing it.
- Club profiles retain their older `config/clubs.json` fallback roster. Actual match lineups are stored in per-match drafts; they may differ across rounds and should not silently overwrite a club's general profile roster.
- Stats remains a placeholder. Reported podiums and raw-export details are available in the match archive.
- Repository inspection showed both the custom tournament workflow and GitHub's Pages build activity. The tracked generated index is retained so existing static paths continue to work. Any later publishing-settings cleanup should verify the selected Pages source before removing that file.
- Hakuraku's live sample upload was not verified. The supplied practice sample is not an official match. Original race export parsing is implemented; replay and skill-event graphs are not.
