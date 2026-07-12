from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from ccbd.api_models import DeliveryScope, JobRecord, JobStatus, MessageEnvelope
from cli.services.role_command_policy import claude_permission_allowlist, load_role_command_policy
from cli.services.plan_tasks import plan_task
from cli.services.task_set_closure import evaluate_task_set_closure
from provider_execution.fake import FakeProviderAdapter
from rolepacks.manifest import load_role_manifest
from test_task_set_closure import _complete, _context, _create_set


REPO_ROOT = Path(__file__).resolve().parents[1]
WORKFLOW_DRAFTS = REPO_ROOT / 'docs/plantree/plans/agentic-loop-workflow/drafts'
CORPUS_PATH = REPO_ROOT / 'test/fixtures/decision029_task_set_closure.v1.json'
RESULT_BY_AGGREGATE = {
    'pass': 'closure_complete',
    'partial': 'closure_partial',
    'replan_required': 'task_set_replanned',
    'blocked': 'closure_blocked',
}


def _corpus() -> dict[str, object]:
    return json.loads(CORPUS_PATH.read_text(encoding='utf-8'))


def _job(*, agent_name: str, body: str) -> JobRecord:
    return JobRecord(
        job_id=f'job-{agent_name}', submission_id=None, agent_name=agent_name,
        provider='fake',
        request=MessageEnvelope(
            project_id='project-decision029', to_agent=agent_name,
            from_actor='system', body=body, task_id='decision029-closure',
            reply_to=None, message_type='ask', delivery_scope=DeliveryScope.SINGLE,
        ),
        status=JobStatus.QUEUED, terminal_decision=None, cancel_requested_at=None,
        created_at='2026-07-12T00:00:00Z', updated_at='2026-07-12T00:00:00Z',
    )


def _planner_body(closure: dict[str, object]) -> str:
    envelope = {
        'schema': 'ccb.plan.task_set_closure_transport.v1',
        'closure': closure,
        'closure_intent': {
            'intent_id': 'intent-decision029',
            'task_set_id': closure['task_set_id'],
            'task_set_revision': closure['task_set_revision'],
            'ordered_terminal_evidence_digest': closure['ordered_terminal_evidence_digest'],
            'closure_digest': closure['closure_digest'],
        },
    }
    return '**task-set-closure.json**\n```json\n' + json.dumps(envelope, sort_keys=True) + '\n```'


def _payload(reply: str, label: str) -> dict[str, object]:
    prefix = f'**{label}**\n```json\n'
    assert reply.startswith(prefix) and reply.endswith('\n```')
    return json.loads(reply[len(prefix):-4])


def _generated_closure(tmp_path: Path, results: list[str]) -> dict[str, object]:
    context = _context(tmp_path)
    specs = [(f'child-{index}', True) for index in range(len(results))]
    created = _create_set(context, specs)
    for (task_id, _required), result in zip(specs, results):
        _complete(context, task_id, result)
    evaluated = evaluate_task_set_closure(
        context,
        task_set_id=created['task_set']['task_set_id'],
    )
    assert evaluated['status'] == 'closure_pending'
    return evaluated['closure']


def _generated_non_execution_closure(tmp_path: Path, *, result: str) -> dict[str, object]:
    context = _context(tmp_path)
    created = _create_set(context, [('child-no-execution', True)])
    kind = 'blocker_evidence' if result == 'blocked' else 'macro_adjustment_request'
    artifact = Path(context.project.project_root) / 'drafts' / f'{kind}.md'
    artifact.parent.mkdir(parents=True, exist_ok=True)
    artifact.write_text(f'# {kind}\n', encoding='utf-8')
    plan_task(context, SimpleNamespace(
        action='task-artifact', task_id='child-no-execution',
        artifact_kind=kind, file_path=str(artifact),
    ))
    plan_task(context, SimpleNamespace(
        action='task-status', task_id='child-no-execution', status=result,
        activation_reason='decision029_fixture',
    ))
    evaluated = evaluate_task_set_closure(
        context, task_set_id=created['task_set']['task_set_id'],
    )
    assert evaluated['status'] == 'closure_pending'
    return evaluated['closure']


def _planner_reply(closure: dict[str, object]) -> dict[str, object]:
    reply = FakeProviderAdapter(latency_seconds=0).start(
        _job(agent_name='planner', body=_planner_body(closure)),
        context=None,
        now='2026-07-12T00:00:00Z',
    ).reply
    return _payload(reply, 'planner-backfill.json')


def test_corpus_is_generator_backed_and_non_acceptance() -> None:
    corpus = _corpus()
    assert corpus['schema'] == 'ccb.decision029.fake_closure_scenarios.v2'
    assert corpus['generator'].endswith('evaluate_task_set_closure')
    assert corpus['evidence_scope'] == 'source_fake_protocol_only_not_acceptance'


@pytest.mark.parametrize('scenario', _corpus()['scenarios'], ids=lambda case: case['case_id'])
def test_fake_planner_accepts_exact_production_closure(tmp_path: Path, scenario: dict[str, object]) -> None:
    closure = _generated_closure(tmp_path, scenario['child_results'])
    assert set(closure) == {
        'schema', 'schema_version', 'task_set_id', 'task_set_revision',
        'source_request', 'planner_job', 'expected_plan_revision', 'ordered_children',
        'ordered_terminal_evidence_digest', 'status', 'aggregate_result', 'reason',
        'created_at', 'closure_digest',
    }
    proposal = _planner_reply(closure)
    assert proposal['expected_plan_revision'] == closure['expected_plan_revision']['digest']
    assert proposal['aggregate_result'] == scenario['aggregate_result']
    assert proposal['result'] == RESULT_BY_AGGREGATE[scenario['aggregate_result']]
    assert proposal['closure_evidence_digest'] == closure['ordered_terminal_evidence_digest']
    assert proposal['frontdesk_status']['aggregate_result'] == scenario['aggregate_result']
    assert 'accepted_scope' not in closure
    assert 'frontdesk_notification_required' not in closure


@pytest.mark.parametrize(
    'mutation',
    ('missing_task_revision', 'missing_round', 'missing_release', 'missing_cleanup', 'unknown_child'),
)
def test_fake_planner_rejects_incomplete_or_extended_child_authority(tmp_path: Path, mutation: str) -> None:
    closure = deepcopy(_generated_closure(tmp_path, ['pass']))
    child = closure['ordered_children'][0]
    if mutation == 'missing_task_revision':
        child.pop('task_revision')
    elif mutation == 'missing_round':
        child['authority'].pop('round_path')
    elif mutation == 'missing_release':
        child['authority'].pop('release')
    elif mutation == 'missing_cleanup':
        child['authority'].pop('cleanup')
    else:
        child['unexpected'] = True
    with pytest.raises(ValueError, match='child'):
        _planner_reply(closure)


@pytest.mark.parametrize('result', ('blocked', 'replan_required'))
def test_fake_planner_accepts_production_non_execution_authority(tmp_path: Path, result: str) -> None:
    closure = _generated_non_execution_closure(tmp_path, result=result)
    authority = closure['ordered_children'][0]['authority']
    assert set(authority) == {'artifact_kind', 'artifact_digest', 'release', 'cleanup'}
    assert authority['release']['status'] == 'not_applicable_no_execution'
    assert _planner_reply(closure)['aggregate_result'] == result


def test_fake_planner_rejects_ordered_evidence_and_closure_digest_tampering(tmp_path: Path) -> None:
    closure = _generated_closure(tmp_path, ['pass'])
    terminal_tamper = deepcopy(closure)
    terminal_tamper['ordered_terminal_evidence_digest'] = 'sha256:' + '0' * 64
    with pytest.raises(ValueError, match='ordered terminal evidence digest mismatch'):
        _planner_reply(terminal_tamper)
    closure_tamper = deepcopy(closure)
    closure_tamper['reason'] = 'tampered'
    with pytest.raises(ValueError, match='closure digest mismatch'):
        _planner_reply(closure_tamper)


def test_nonterminal_or_system_failure_child_cannot_produce_pass(tmp_path: Path) -> None:
    closure = deepcopy(_generated_closure(tmp_path, ['pass']))
    closure['ordered_children'][0]['evidence_status'] = 'system_failure'
    with pytest.raises(ValueError, match='terminal evidence'):
        _planner_reply(closure)


def test_duplicate_closure_envelope_is_rejected(tmp_path: Path) -> None:
    body = _planner_body(_generated_closure(tmp_path, ['pass']))
    with pytest.raises(ValueError, match='exactly one fenced'):
        FakeProviderAdapter(latency_seconds=0).start(
            _job(agent_name='planner', body=body + '\n' + body), context=None,
            now='2026-07-12T00:00:00Z',
        )


def _frontdesk_status(tmp_path: Path, results: list[str]) -> dict[str, object]:
    return _planner_reply(_generated_closure(tmp_path, results))['frontdesk_status']


def _send_frontdesk(status: dict[str, object]) -> str:
    body = '**frontdesk-status.json**\n```json\n' + json.dumps(status, sort_keys=True) + '\n```'
    return FakeProviderAdapter(latency_seconds=0).start(
        _job(agent_name='frontdesk', body=body), context=None,
        now='2026-07-12T00:00:00Z',
    ).reply


def test_duplicate_frontdesk_envelope_is_rejected(tmp_path: Path) -> None:
    status = _frontdesk_status(tmp_path, ['pass'])
    section = '**frontdesk-status.json**\n```json\n' + json.dumps(status, sort_keys=True) + '\n```'
    with pytest.raises(ValueError, match='exactly one fenced'):
        FakeProviderAdapter(latency_seconds=0).start(
            _job(agent_name='frontdesk', body=section + '\n' + section), context=None,
            now='2026-07-12T00:00:00Z',
        )


def test_fake_frontdesk_preserves_validated_non_success_report(tmp_path: Path) -> None:
    status = _frontdesk_status(tmp_path, ['pass', 'blocked'])
    original = deepcopy(status)
    assert _send_frontdesk(status) == original['user_report_body']
    assert status == original


@pytest.mark.parametrize(
    ('mutation', 'error'),
    (
        (lambda status: status.update(notification_identity=''), 'notification_identity'),
        (lambda status: status['next_milestone'].update(kind='made_up'), 'kind'),
        (lambda status: status['next_milestone'].update(ref=''), 'ref'),
        (lambda status: status['next_milestone'].update(rationale=''), 'rationale'),
        (lambda status: status.update(unresolved_scope=[]), 'unresolved_scope'),
        (lambda status: status.update(extra='unknown'), 'fields'),
    ),
)
def test_fake_frontdesk_rejects_invalid_or_laundered_status(
    tmp_path: Path, mutation, error: str,
) -> None:
    status = _frontdesk_status(tmp_path, ['pass', 'blocked'])
    mutation(status)
    with pytest.raises(ValueError, match=error):
        _send_frontdesk(status)


def test_closure_rolepack_templates_use_digest_revision_and_exact_mode() -> None:
    planner_root = WORKFLOW_DRAFTS / 'agentroles.ccb_planner'
    backfill = json.loads((planner_root / 'templates/planner-backfill.json').read_text(encoding='utf-8'))
    skill = (planner_root / 'skills/planner-closure-backfill/SKILL.md').read_text(encoding='utf-8')
    assert backfill['mode'] == 'task_set_closure'
    assert backfill['expected_plan_revision'] == 'sha256:<64 lowercase hex>'
    assert list(backfill).count('frontdesk_status') == 1
    assert 'expected_plan_revision is a digest' in skill
    for mapping in ('pass -> closure_complete', 'partial -> closure_partial', 'replan_required -> task_set_replanned', 'blocked -> closure_blocked'):
        assert mapping in skill
    assert 'No PlanTree write' in skill


def test_planner_and_frontdesk_command_surfaces_remain_narrow() -> None:
    planner = load_role_manifest(WORKFLOW_DRAFTS / 'agentroles.ccb_planner')
    planner_policy = load_role_command_policy(planner)
    frontdesk = load_role_manifest(WORKFLOW_DRAFTS / 'agentroles.ccb_frontdesk')
    frontdesk_policy = load_role_command_policy(frontdesk)
    assert planner_policy is not None and planner_policy.allowed == ()
    assert planner_policy.provider_tools == () and claude_permission_allowlist(planner_policy) == ()
    assert {'shell_exec', 'generic_ccb', 'file_write', 'test_exec', 'wait', 'watch', 'arbitrary_target', 'notification_send'} <= set(planner_policy.forbidden_effects)
    assert frontdesk_policy is not None and len(frontdesk_policy.allowed) == 1
    assert frontdesk_policy.allowed[0].required_args[-1] == 'planner'
    assert frontdesk_policy.allowed[0].stdin_schema == 'inline:ccb.frontdesk.intake.v1'
    assert frontdesk_policy.provider_tools == (('codex', 'ccb_frontdesk_ask_planner'),)
    assert claude_permission_allowlist(frontdesk_policy) == ('Bash(ask --silence --compact --inline-request --task-id *)',)


def test_frontdesk_rolepack_renders_only_validated_status_and_never_forwards_it() -> None:
    root = WORKFLOW_DRAFTS / 'agentroles.ccb_frontdesk'
    combined = '\n'.join((root / path).read_text(encoding='utf-8') for path in (
        'memory.md', 'adapters/ccb/memory.md', 'skills/frontdesk-intake/SKILL.md',
        'templates/workflow-status-report.md',
    ))
    assert 'validated `ccb.planner.frontdesk_status.v1`' in combined
    assert 'byte-for-byte' in combined
    assert 'render only `user_report_body`' in combined.lower()
    assert 'never forward' in combined.lower()
    assert 'never mutate authority' in combined.lower()
