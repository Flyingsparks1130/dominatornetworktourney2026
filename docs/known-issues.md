# Known content inconsistencies

These are preserved explicitly rather than resolved by inventing tournament rules.

- The owner confirmed six standard tracks plus a reserved tiebreaker, now reflected in rules and configuration. The old global pre-ban wording still says one per club, while all three supplied R1 drafts contain two per club; preserve the match records and confirm the global pre-ban rule before changing it.
- Club pages show the latest populated match lineup, labeled with its round. Verified race owner names take precedence for that match; names from older reported drafts are kept in those historical matches. Discord IDs without a known name show "Name pending". The older `config/clubs.json` is only a fallback when no match lineup exists.
- Stats remains a placeholder. Reported podiums and raw-export details are available in the match archive.
- Repository inspection showed both the custom tournament workflow and GitHub's Pages build activity. The tracked generated index is retained so existing static paths continue to work. Any later publishing-settings cleanup should verify the selected Pages source before removing that file.
- Native results, replay, synchronized positioning and recent skill-event labels are implemented for the supplied global horseACT exports. Hakuraku's model-based downhill, pace and wit-lottery estimates and individual skill-analysis graphs remain outside this implementation. See [race analysis](race-analysis.md) for supported data and measurement details. The separate practice sample remains outside official results.
