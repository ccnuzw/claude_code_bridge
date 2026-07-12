from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from cli.services.planner_feedback import parse_planner_feedback_reply, planner_feedback_digest
from cli.services.planner_feedback_apply import apply_planner_feedback


def _digest(char: str) -> str:
    return 'sha256:' + char * 64


def _context(tmp_path: Path):
    root = tmp_path / 'project'
    plan = root / 'docs/plantree/plans/demo'
    plan.mkdir(parents=True)
    (plan / 'README.md').write_text('# Demo\n', encoding='utf-8')
    return SimpleNamespace(project=SimpleNamespace(project_root=root, project_id='p'))


def _proposal(plan_revision: str):
    evidence = ['docs/plantree/plans/demo/task-sets/set-a/closure.json']
    status = {
        'schema': 'ccb.planner.frontdesk_status.v1', 'notification_identity': 'set-a-r1',
        'aggregate_result': 'pass', 'accepted_scope': ['landed'], 'unresolved_scope': [],
        'blockers': [], 'next_milestone': {'kind': 'workflow_terminal', 'ref': 'done', 'rationale': 'Done.'},
        'evidence_refs': evidence, 'user_report_body': 'Done.',
    }
    payload = {
        'schema': 'ccb.planner.backfill_proposal.v1', 'mode': 'task_set_closure',
        'expected_plan_revision': plan_revision, 'task_or_task_set_id': 'set-a',
        'task_or_task_set_revision': 1, 'closure_evidence_digest': _digest('a'),
        'aggregate_result': 'pass', 'result': 'closure_complete', 'brief_summary': 'Closed.',
        'roadmap_transitions': [{'id': 'm1', 'status': 'done', 'summary': 'Landed.', 'evidence_refs': evidence}],
        'todo_transitions': [{'id': 't1', 'status': 'done', 'summary': 'Checked.', 'evidence_refs': evidence}],
        'decision_refs': ['decisions/029.md'], 'open_question_refs': [], 'evidence_refs': evidence,
        'accepted_scope': ['landed'], 'unresolved_scope': [], 'blockers': [], 'replan_inputs': [],
        'next_milestone': status['next_milestone'], 'frontdesk_notification_required': True,
        'frontdesk_status': status,
    }
    return parse_planner_feedback_reply('**planner-backfill.json**\n```json\n' + json.dumps(payload) + '\n```\n')


def _authority_files(context, authority: dict[str, object]) -> None:
    root = Path(context.project.project_root) / 'docs/plantree/plans/demo/task-sets/set-a'
    root.mkdir(parents=True)
    (root / 'task-set.json').write_text(json.dumps({
        'task_set_id': 'set-a', 'task_set_revision': 1, 'state': 'closure_pending',
        'plan_revision': {'digest': authority['expected_plan_revision']},
    }), encoding='utf-8')
    (root / 'closure.json').write_text(json.dumps({
        'task_set_id': 'set-a', 'task_set_revision': 1,
        'closure_digest': authority['closure_digest'],
        'ordered_terminal_evidence_digest': authority['ordered_terminal_evidence_digest'],
        'aggregate_result': 'pass',
    }), encoding='utf-8')


def test_apply_is_revision_fenced_persisted_and_idempotent(tmp_path: Path) -> None:
    context = _context(tmp_path)
    from cli.services.planner_feedback_apply import current_plan_revision
    revision = current_plan_revision(context, 'demo')
    proposal = _proposal(revision)
    authority = {
        'task_set_id': 'set-a', 'task_set_revision': 1, 'closure_intent_id': 'tsi-a',
        'closure_digest': _digest('c'), 'ordered_terminal_evidence_digest': _digest('a'),
        'expected_plan_revision': revision, 'planner_job_id': 'job-planner',
        'planner_feedback_digest': planner_feedback_digest(proposal), 'plan_slug': 'demo',
    }
    _authority_files(context, authority)

    first = apply_planner_feedback(context, proposal, authority)
    replay = apply_planner_feedback(context, proposal, authority)

    assert first['status'] == replay['status'] == 'imported'
    assert replay['idempotent'] is True
    backfill = Path(first['planner_backfill_path'])
    assert backfill.is_file()
    assert json.loads(backfill.read_text())['planner_job_id'] == 'job-planner'
    assert '<!-- ccb-planner-backfill:set-a:brief:start -->' in (
        Path(context.project.project_root) / 'docs/plantree/plans/demo/README.md'
    ).read_text()


def test_apply_rejects_revision_conflict_before_write(tmp_path: Path) -> None:
    context = _context(tmp_path)
    proposal = _proposal(_digest('f'))
    authority = {
        'task_set_id': 'set-a', 'task_set_revision': 1, 'closure_intent_id': 'tsi-a',
        'closure_digest': _digest('c'), 'ordered_terminal_evidence_digest': _digest('a'),
        'expected_plan_revision': _digest('f'), 'planner_job_id': 'job-planner',
        'planner_feedback_digest': planner_feedback_digest(proposal), 'plan_slug': 'demo',
    }
    _authority_files(context, authority)
    with pytest.raises(ValueError, match='revision conflict'):
        apply_planner_feedback(context, proposal, authority)
    assert not list(Path(context.project.project_root).rglob('planner-backfill.json'))


def test_apply_recovers_partial_target_writes_exactly_once(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    context = _context(tmp_path)
    from cli.services import planner_feedback_apply as service
    revision = service.current_plan_revision(context, 'demo')
    proposal = _proposal(revision)
    authority = {
        'task_set_id': 'set-a', 'task_set_revision': 1, 'closure_intent_id': 'tsi-a',
        'closure_digest': _digest('c'), 'ordered_terminal_evidence_digest': _digest('a'),
        'expected_plan_revision': revision, 'planner_job_id': 'job-planner',
        'planner_feedback_digest': planner_feedback_digest(proposal), 'plan_slug': 'demo',
    }
    _authority_files(context, authority)
    original = service.atomic_write_text
    writes = 0

    def crash_after_first(path, text):
        nonlocal writes
        writes += 1
        if writes == 2:
            raise RuntimeError('injected crash')
        return original(path, text)

    monkeypatch.setattr(service, 'atomic_write_text', crash_after_first)
    with pytest.raises(RuntimeError, match='injected crash'):
        service.apply_planner_feedback(context, proposal, authority)
    monkeypatch.setattr(service, 'atomic_write_text', original)

    recovered = service.apply_planner_feedback(context, proposal, authority)
    assert recovered['status'] == 'imported'
    assert Path(recovered['planner_backfill_path']).is_file()
