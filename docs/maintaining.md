# Maintaining and publishing

## Connected conversation workflow

1. The organizer supplies the requested change or confirmed match information in ChatGPT / Codex.
2. Codex fetches the latest GitHub state and edits a focused branch. It preserves other match records and checks score arithmetic, identities and advancement through the tournament engine.
3. Codex validates the implementation and opens a pull request. For a requested publication, it waits for successful checks, merges, and verifies the resulting deployment.
4. GitHub Actions tests the importer, rebuilds the index from tournament folders, and publishes the static website. Codex returns the update link and deployment result.

You do not need to download files or run a launcher for changes completed in this workflow. Only the connected assistant session edits the repository; there is no unattended agent making speculative changes.

If access or a repository rule blocks an action, Codex should report the exact blocked step and retain the prepared work instead of claiming it was published.

## Local organizer remains available

Use `manage_tournament.bat` if you want to enter results yourself. It starts a local Python server bound to `127.0.0.1`; it does not run on GitHub Pages. The console persists decisions to the repository, not browser storage.

For local edits, first fetch and pull in GitHub Desktop. Review and commit your local changes, then push. Avoid copying an old ZIP over newer repository files.

`rebuild_tournament.bat` rebuilds local data. `publish_latest.bat` is an older compatibility entry point that also rescans folders. `randomize_draw.bat` does not reroll the supplied fixed bracket. `apply_LHNCFL_result.bat` is an idempotent one-time helper for the existing LHNCFL report; the connected workflow has already applied that match.

## Build and deployment

`.github/workflows/tournament-pages.yml` runs on pull requests, pushes to `main`, and manual dispatch. Pull requests test and build; main updates publish with the existing GitHub Pages environment. Invalid or duplicate exports fail the build.

```sh
python -m unittest discover -s tests -v
python scripts/tournament_engine.py site
```

The `_site/` directory is generated and ignored by Git. It contains public pages, assets, active config, generated data and the tournament archive. `legacy/`, tests, scripts and historical documentation are excluded. Keep the tracked index regenerated when match data changes; do not edit generated scores directly.

No repository token belongs in browser JavaScript, uploaded match files, or committed configuration. The connected GitHub app performs repository writes; GitHub Actions uses its existing workflow permissions for publishing.

## Corrections

Use the engine's score, mapping, advance, forfeit and reopen mutations so revisions and audit history remain valid. An earlier winner cannot change while downstream decisions, race files or populated drafts depend on that outcome. Resolve affected later matches explicitly rather than deleting their history during cleanup.

If a local clone has unrelated edits, keep them isolated and reconcile with current `main` before publishing. Changes made through the connected workflow are already remote; GitHub Desktop's **Fetch origin / Pull origin** is only needed when you want to bring that local clone up to date.
