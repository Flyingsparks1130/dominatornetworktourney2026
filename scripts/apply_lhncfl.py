"""Apply the organizer-supplied LHNCFL result without replacing other decisions."""
from pathlib import Path
from tournament_engine import build, mutate, TournamentError

SCORES = {'dominion': 22, 'dominarium': 27}


def apply(root):
    state = build(root, write=False)
    match = next(m for m in state['index']['matches'] if m['id'] == 'r1-m1')
    report = match['reported_results']
    if not report or report['external_match_id'] != 'LHNCFL' or report['totals'] != SCORES:
        raise TournamentError('LHNCFL report missing or scores differ from the supplied 22–27 result.')
    if match['manual_scores'] == SCORES and match['winner_id'] == 'dominarium':
        return build(root)
    return mutate(root, {
        'revision': state['index']['revision'], 'action': 'record_report',
        'match_id': 'r1-m1', 'scores': SCORES, 'winner_id': 'dominarium',
        'reason': 'Organizer-confirmed LHNCFL: Dominion 22–27 Dominarium, seven races, MVP @LESKBILL.',
    })


if __name__ == '__main__':
    try:
        apply(Path(__file__).resolve().parents[1])
        print('Saved: Dominion 22 - 27 Dominarium. Dominarium advances to face Dominator in R2.')
        print('Other match decisions are preserved. Review and commit the changes in GitHub Desktop, then push.')
    except (TournamentError, OSError) as exc:
        print('Could not apply LHNCFL:', exc)
        raise SystemExit(1)
