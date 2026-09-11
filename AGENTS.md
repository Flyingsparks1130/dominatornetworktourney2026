# Repository maintenance

## Delivery

- The owner prefers direct GitHub updates for requested work. Do not make ZIP copying or GitHub Desktop a required delivery step unless requested.
- Fetch the current remote state before editing. Preserve concurrent work and existing tournament records.
- Use a focused branch and pull request for changes. Run the tests and build; inspect the PR checks before merging when publication is authorized by the task. Report the PR and deployment outcome accurately.
- Respect branch protections and required checks. Never force-push or bypass a failing gate. Do not claim deployment from a local build alone.

## Sources of truth

- `Dominator Tournament/tournament.json`: clubs and bracket structure.
- `Dominator Tournament/control.json`: official scores, winners, runner assignments, revisions and audit history. Use the existing engine mutation functions to make organizer decisions; preserve unrelated decisions.
- Per-match `draft.json`: track card, draft actions, roster and bench. Per-match `results.json`: organizer-reported podiums and MVP.
- Original race exports live inside race-description subfolders and must remain unchanged. Do not fabricate race exports for score-only matches.
- Reported podium totals and exported race totals are separate; never add them together. Never infer a winner from a draft or score threshold.
- `legacy/` and `docs/history/` are inactive references, not current configuration.

## Validation and scope

- Preserve the static HTML/JavaScript and standard-library Python architecture.
- Run `python -m unittest discover -s tests -v` and `python scripts/tournament_engine.py site` for importer, scoring, organizer, or data changes.
- Regenerate tracked `data/tournament-index.json` when tournament data changes. It supports the existing local/static paths; do not remove it without validating the publishing setup.
- Match data and fixtures must remain separate. The supplied practice export must not be counted as an official race.
- Preserve the homepage design, shared stylesheet and bracket geometry unless the task requests a change there. Known copy inconsistencies are recorded in `docs/known-issues.md`; do not silently invent rules to reconcile them.
- Keep current documentation in `docs/`, with a concise root README. Maintain compatibility links and launchers when useful. Check references before moving code or data.
