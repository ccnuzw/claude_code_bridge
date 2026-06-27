from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

from cli.models import ParsedAskCommand
from storage.atomic import atomic_write_json

from .ask import submit_ask
from .loop_run_once import loop_run_once
from .plan_tasks import find_first_actionable_task, plan_task
from .questions import question_refs


def loop_runner_once(context, command, services=None) -> dict[str, object]:
    deps = _deps(services)
    task = find_first_actionable_task(context)
    if task is None:
        return {
            'schema_version': 1,
            'record_type': 'ccb_loop_runner_once',
            'loop_runner_status': 'idle',
            'project_id': context.project.project_id,
            'project_root': str(context.project.project_root),
            'action': 'none',
            'reason': 'no_actionable_task',
        }

    runner_action = str(task.get('runner_action') or '')
    if runner_action == 'execute':
        return _run_execution_round(context, command, deps, task)
    if runner_action == 'activate_planner':
        return _activate_planner(context, command, deps, task)
    if runner_action == 'activate_plan_reviewer':
        return _activate_plan_reviewer(context, command, deps, task)
    return _stop_without_activation(context, task)


def _run_execution_round(context, command, deps, task: dict[str, object]) -> dict[str, object]:
    record = task['record']
    task_id = str(record.get('task_id') or '')
    loop_id = f'lp{uuid4().hex[:6]}'
    bind = deps.plan_task(
        context,
        SimpleNamespace(action='task-bind-loop', task_id=task_id, loop_id=loop_id),
    )
    round_payload = deps.loop_run_once(
        context,
        SimpleNamespace(
            kind='loop-run-once',
            project=None,
            loop_id=loop_id,
            task=None,
            task_id=task_id,
            worker_profile='worker',
            reviewer_profile='code_reviewer',
            orchestrator='orchestrator',
            round_checker='round_checker',
            timeout_s=getattr(command, 'timeout_s', None),
            json_output=True,
        ),
        deps.services,
    )
    round_result, round_result_source = _round_result(round_payload)
    report_path = _round_report_path(round_payload)
    imported = deps.plan_task(
        context,
        SimpleNamespace(
            action='task-import-round',
            task_id=task_id,
            loop_id=loop_id,
            result=round_result,
            file_path=report_path,
            actor_source='loop_runner',
            actor='loop_runner',
            job_id=str(_first_job_id(round_payload) or ''),
        ),
    )
    return {
        'schema_version': 1,
        'record_type': 'ccb_loop_runner_once',
        'loop_runner_status': 'ok',
        'project_id': context.project.project_id,
        'project_root': str(context.project.project_root),
        'action': 'ran_one_round',
        'task_id': task_id,
        'loop_id': loop_id,
        'round_result': round_result,
        'round_result_source': round_result_source,
        'task_status': imported.get('status'),
        'bind': _compact_plan_payload(bind),
        'round': {
            'loop_run_status': round_payload.get('loop_run_status'),
            'round_path': report_path,
        },
        'import': _compact_plan_payload(imported),
        'next_activation': _next_activation(imported.get('status')),
    }


def _activate_planner(context, command, deps, task: dict[str, object]) -> dict[str, object]:
    record = dict(task['record'])
    task_id = str(record.get('task_id') or '')
    activation_id = f'act-{uuid4().hex[:12]}'
    activation = _planner_activation_packet(
        context,
        record,
        activation_id=activation_id,
        action=str(task.get('runner_action') or 'activate_planner'),
        reason=str(task.get('runner_reason') or 'planner_state'),
    )
    activation_path = _activation_path(context, activation_id)
    atomic_write_json(activation_path, activation)
    summary = deps.submit_ask(
        context,
        ParsedAskCommand(
            project=None,
            target='planner',
            sender='system',
            message=_planner_message(activation),
            task_id=activation_id,
            compact=True,
            artifact_request=True,
        ),
    )
    job = _single_job(summary.jobs, target='planner')
    activation['ask'] = {
        'target': 'planner',
        'job_id': str(job['job_id']),
        'status': job.get('status'),
    }
    atomic_write_json(activation_path, activation)
    return {
        'schema_version': 1,
        'record_type': 'ccb_loop_runner_once',
        'loop_runner_status': 'ok',
        'project_id': context.project.project_id,
        'project_root': str(context.project.project_root),
        'action': 'activated_planner',
        'reason': activation['reason_for_activation'],
        'task_id': task_id,
        'task_status': record.get('status'),
        'next_owner': 'planner',
        'activation_id': activation_id,
        'activation_path': str(activation_path),
        'ask': activation['ask'],
        'next_activation': 'stop_after_one_activation',
    }


def _activate_plan_reviewer(context, command, deps, task: dict[str, object]) -> dict[str, object]:
    record = dict(task['record'])
    task_id = str(record.get('task_id') or '')
    activation_id = f'act-{uuid4().hex[:12]}'
    activation = _plan_reviewer_activation_packet(
        context,
        record,
        activation_id=activation_id,
        reason=str(task.get('runner_reason') or 'review_required'),
    )
    activation_path = _activation_path(context, activation_id)
    atomic_write_json(activation_path, activation)
    summary = deps.submit_ask(
        context,
        ParsedAskCommand(
            project=None,
            target='plan_reviewer',
            sender='system',
            message=_plan_reviewer_message(activation),
            task_id=activation_id,
            compact=True,
            artifact_request=True,
        ),
    )
    job = _single_job(summary.jobs, target='plan_reviewer')
    activation['ask'] = {
        'target': 'plan_reviewer',
        'job_id': str(job['job_id']),
        'status': job.get('status'),
    }
    atomic_write_json(activation_path, activation)
    return {
        'schema_version': 1,
        'record_type': 'ccb_loop_runner_once',
        'loop_runner_status': 'ok',
        'project_id': context.project.project_id,
        'project_root': str(context.project.project_root),
        'action': 'activated_plan_reviewer',
        'reason': activation['reason_for_activation'],
        'task_id': task_id,
        'task_status': record.get('status'),
        'next_owner': 'plan_reviewer',
        'activation_id': activation_id,
        'activation_path': str(activation_path),
        'ask': activation['ask'],
        'next_activation': 'stop_after_one_activation',
    }


def _stop_without_activation(context, task: dict[str, object]) -> dict[str, object]:
    record = dict(task['record'])
    action = str(task.get('runner_action') or 'stop')
    payload = {
        'schema_version': 1,
        'record_type': 'ccb_loop_runner_once',
        'loop_runner_status': 'paused' if action == 'paused' else action,
        'project_id': context.project.project_id,
        'project_root': str(context.project.project_root),
        'action': action,
        'reason': task.get('runner_reason'),
        'task_id': record.get('task_id'),
        'task_status': record.get('status'),
        'next_owner': task.get('next_owner'),
        'next_activation': 'none',
    }
    if action == 'paused' and str(record.get('task_id') or '').strip():
        payload['question_refs'] = question_refs(context, record.get('task_id'))
    return payload


def _deps(services):
    return SimpleNamespace(
        loop_run_once=getattr(services, 'loop_run_once', loop_run_once),
        plan_task=getattr(services, 'plan_task', plan_task),
        submit_ask=getattr(services, 'submit_ask', submit_ask),
        services=services,
    )


def _round_result(payload: dict[str, object]) -> tuple[str, str]:
    declared = _declared_round_result(payload)
    if declared is not None:
        return declared, 'round_checker_reply'
    if str(payload.get('loop_run_status') or '') == 'ok':
        return 'blocked', 'missing_round_checker_result'
    return 'blocked', 'loop_run_status'


def _declared_round_result(payload: dict[str, object]) -> str | None:
    checker = payload.get('round_checker') if isinstance(payload.get('round_checker'), dict) else {}
    reply = str(checker.get('reply') or '')
    mapping = {
        'pass': 'pass',
        'partial': 'partial',
        'replan_required': 'replan_required',
        'blocked': 'blocked',
        'global_blocker': 'blocked',
    }
    for raw_line in reply.splitlines():
        line = raw_line.strip().lower().lstrip('-').strip()
        if not line.startswith('round result:'):
            continue
        value = line.split(':', 1)[1].strip().split()[0].strip('`.,;')
        return mapping.get(value)
    return None


def _round_report_path(payload: dict[str, object]) -> str:
    paths = payload.get('paths') if isinstance(payload.get('paths'), dict) else {}
    path = str(paths.get('round') or '').strip()
    if not path:
        raise RuntimeError('loop runner cannot import round result without round path')
    if not Path(path).is_file():
        raise RuntimeError(f'loop runner round report is missing: {path}')
    return path


def _compact_plan_payload(payload: dict[str, object]) -> dict[str, object]:
    return {
        'action': payload.get('action'),
        'task_id': payload.get('task_id'),
        'status': payload.get('status'),
        'plan_slug': payload.get('plan_slug'),
        'task_root': payload.get('task_root'),
        'idempotent': payload.get('idempotent'),
    }


def _next_activation(status: object) -> str:
    value = str(status or '')
    if value == 'done':
        return 'stop'
    if value in {'partial', 'replan_required'}:
        return 'planner'
    if value == 'blocked':
        return 'frontdesk_or_recovery'
    return 'inspect'


def _planner_activation_packet(
    context,
    record: dict[str, object],
    *,
    activation_id: str,
    action: str,
    reason: str,
) -> dict[str, object]:
    artifacts = record.get('artifacts') if isinstance(record.get('artifacts'), dict) else {}
    task_root = Path(context.project.project_root) / str(record.get('task_root') or '')
    round_refs = [
        artifact
        for kind, artifact in sorted(artifacts.items())
        if str(kind).startswith('round_') and isinstance(artifact, dict)
    ]
    return {
        'schema_version': 1,
        'record_type': 'ccb_loop_planner_activation',
        'activation_id': activation_id,
        'project_id': context.project.project_id,
        'project_root': str(context.project.project_root),
        'task_id': record.get('task_id'),
        'task_status': record.get('status'),
        'action': action,
        'reason_for_activation': reason,
        'required_next_output': 'task-packet artifacts and readiness recommendation',
        'task_packet_root': str(task_root.relative_to(context.project.project_root)),
        'artifact_refs': {
            kind: artifact.get('path')
            for kind, artifact in sorted(artifacts.items())
            if isinstance(artifact, dict) and artifact.get('path')
        },
        'round_evidence_refs': tuple(
            {
                'kind': artifact.get('kind'),
                'path': artifact.get('path'),
                'round_result': artifact.get('round_result'),
                'loop_id': artifact.get('loop_id'),
            }
            for artifact in round_refs
        ),
        'open_question_refs': _planner_question_refs(context, record),
        'script_write_rules': [
            'Do not edit task status, index, or current_loop directly.',
            'Use ccb plan task-artifact and ccb plan task-status for authoritative writes.',
            'Return needs_clarification, blocked, not_ready, or ready instead of lowering acceptance criteria.',
        ],
        'stop_limits': [
            'one planner activation per loop runner --once',
            'no recursive execution inside planner activation',
            'artifact links preferred over pasted runtime logs',
        ],
    }


def _plan_reviewer_activation_packet(
    context,
    record: dict[str, object],
    *,
    activation_id: str,
    reason: str,
) -> dict[str, object]:
    artifacts = record.get('artifacts') if isinstance(record.get('artifacts'), dict) else {}
    task_root = Path(context.project.project_root) / str(record.get('task_root') or '')
    return {
        'schema_version': 1,
        'record_type': 'ccb_loop_plan_reviewer_activation',
        'activation_id': activation_id,
        'project_id': context.project.project_id,
        'project_root': str(context.project.project_root),
        'task_id': record.get('task_id'),
        'task_status': record.get('status'),
        'action': 'activate_plan_reviewer',
        'reason_for_activation': reason,
        'required_next_output': 'review artifact and readiness recommendation',
        'task_packet_root': str(task_root.relative_to(context.project.project_root)),
        'artifact_refs': {
            kind: artifact.get('path')
            for kind, artifact in sorted(artifacts.items())
            if isinstance(artifact, dict) and artifact.get('path')
        },
        'script_write_rules': [
            'Do not edit task status, index, or current_loop directly.',
            'Use ccb plan task-artifact --kind review to import the review.',
            'Use ccb plan task-status --status ready only after review is imported.',
            'Return not_ready, needs_clarification, blocked, or ready without lowering acceptance criteria.',
        ],
        'stop_limits': [
            'one plan_reviewer activation per loop runner --once',
            'no recursive execution inside review activation',
            'artifact links preferred over pasted runtime logs',
        ],
    }


def _question_refs(artifacts: dict[str, object]) -> list[str]:
    refs: list[str] = []
    for kind, artifact in sorted(artifacts.items()):
        if 'question' not in str(kind):
            continue
        if isinstance(artifact, dict) and artifact.get('path'):
            refs.append(str(artifact['path']))
    return refs


def _planner_question_refs(context, record: dict[str, object]) -> dict[str, object] | tuple[str, ...]:
    task_id = str(record.get('task_id') or '').strip()
    if task_id:
        refs = question_refs(context, task_id)
        if int(refs.get('artifact_count') or 0) > 0:
            return refs
    artifacts = record.get('artifacts') if isinstance(record.get('artifacts'), dict) else {}
    return tuple(_question_refs(artifacts))


def _planner_message(activation: dict[str, object]) -> str:
    return (
        'Role: planner\n'
        f"Activation id: {activation.get('activation_id')}\n"
        f"Task: {activation.get('task_id')}\n"
        f"Status: {activation.get('task_status')}\n"
        f"Reason: {activation.get('reason_for_activation')}\n"
        f"Task packet root: {activation.get('task_packet_root')}\n"
        f"Artifact refs: {activation.get('artifact_refs')}\n"
        f"Open question refs: {activation.get('open_question_refs')}\n"
        f"Round evidence refs: {activation.get('round_evidence_refs')}\n\n"
        'Required next output:\n'
        '- draft or update task-packet artifacts\n'
        '- readiness recommendation: ready|needs_clarification|blocked|not_ready\n'
        '- candidate questions only when current-phase user input is blocking\n\n'
        'Script write rules:\n'
        '- use CCB plan commands or host-provided wrappers for authoritative writes\n'
        '- do not edit task index, status, current_loop, runtime capacity, or tmux state directly\n'
        '- do not start worker/checker/orchestrator execution from this activation'
    )


def _plan_reviewer_message(activation: dict[str, object]) -> str:
    return (
        'Role: plan_reviewer\n'
        f"Activation id: {activation.get('activation_id')}\n"
        f"Task: {activation.get('task_id')}\n"
        f"Status: {activation.get('task_status')}\n"
        f"Reason: {activation.get('reason_for_activation')}\n"
        f"Task packet root: {activation.get('task_packet_root')}\n"
        f"Artifact refs: {activation.get('artifact_refs')}\n\n"
        'Required next output:\n'
        '- review artifact covering ambiguity, risk, acceptance, and verification\n'
        '- readiness recommendation: ready|needs_clarification|blocked|not_ready\n\n'
        'Script write rules:\n'
        '- use CCB plan commands or host-provided wrappers for authoritative writes\n'
        '- do not edit task index, status, current_loop, runtime capacity, or tmux state directly\n'
        '- do not start worker/checker/orchestrator execution from this activation'
    )


def _activation_path(context, activation_id: str) -> Path:
    return Path(context.paths.runtime_state_root) / 'runtime' / 'loops' / 'activations' / f'{activation_id}.json'


def _single_job(jobs: tuple[dict, ...], *, target: str) -> dict:
    if len(jobs) != 1:
        raise RuntimeError(f'expected one ask job for {target}; got {len(jobs)}')
    job = dict(jobs[0])
    if not str(job.get('job_id') or ''):
        raise RuntimeError(f'ask job for {target} did not return job_id')
    return job


def _first_job_id(payload: dict[str, object]) -> str:
    for key in ('worker', 'reviewer', 'aggregation', 'round_checker'):
        value = payload.get(key)
        if isinstance(value, dict) and str(value.get('job_id') or '').strip():
            return str(value['job_id'])
    return ''


__all__ = ['loop_runner_once']
