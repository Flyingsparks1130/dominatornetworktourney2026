# Dominator Tournament 2026

[Live tournament](https://flyingsparks1130.github.io/dominatornetworktourney2026/) · [Bracket](https://flyingsparks1130.github.io/dominatornetworktourney2026/bracket.html) · [Build and deployment](https://github.com/Flyingsparks1130/dominatornetworktourney2026/actions/workflows/tournament-pages.yml)

11 clubs. Four rounds. Match-specific drafts, original race exports, reported podiums, and organizer-confirmed advancement.

## Updates through ChatGPT / Codex

Send the requested site changes, draft text, race JSONs, or official scores in the connected conversation. Codex works from the latest repository, changes the relevant files, validates them, and submits the update through GitHub. For an authorized publication, Codex checks the pull request, merges it, and verifies the Pages deployment.

There is no ZIP-copy or GitHub Desktop step for this workflow. GitHub Actions rebuilds and publishes on updates to `main`. GitHub Desktop remains optional for changes you make yourself; fetch and pull remote updates before editing a local copy.

This is a workflow for requested updates during an active conversation. It does not monitor the repository or invent changes in the background.

## Repository map

| Path | Purpose |
| --- | --- |
| `Dominator Tournament/` | Official bracket configuration, organizer decisions, and round/match/race records |
| `assets/` and root HTML pages | Website presentation and navigation |
| `scripts/` | Importing, scoring, organizer controls, and static-site build |
| `tests/` | Regression tests and isolated fixtures |
| `config/clubs.json` | Club-profile roster fallback |
| `config/timeline.json` | Existing homepage schedule |
| `data/tournament-index.json`, `data/tournament-races/` | Generated website data; rebuild instead of hand-editing |
| `docs/` | Current maintenance and match-data guides |
| `docs/history/`, `legacy/` | Superseded instructions and inactive data, preserved for reference |

## Guides

- [Maintaining and publishing the site](docs/maintaining.md)
- [Drafts, reported results, race files, and official decisions](docs/match-data.md)
- [Native race analysis and replay](docs/race-analysis.md)
- [Known content inconsistencies and deferred work](docs/known-issues.md)

## Local development (optional)

Python 3.10+ is sufficient; the backend has no third-party Python dependencies.

```sh
python -m unittest discover -s tests -v
python scripts/tournament_engine.py site
node tests/test_replay_client.js
```

On Windows, `manage_tournament.bat` opens the local organizer and preview. `rebuild_tournament.bat` rescans the archive. These launchers remain available, but are not needed when Codex makes and publishes the update through GitHub.
