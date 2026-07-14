"""Durable, revision-fenced PlanTree projection for one Detailer replan."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from storage.atomic import atomic_write_json, atomic_write_text
from storage.locks import file_lock

from .planner_feedback import PlannerBackfillProposal, planner_feedback_digest
from .planner_feedback_apply import current_plan_revision


def apply_detailer_replan_backfill(context, proposal: PlannerBackfillProposal, *, authority: dict[str, object], planner_job_id: str) -> dict[str, object]:
    required = {'task_id', 'task_revision', 'plan_slug', 'expected_plan_revision', 'closure_evidence_digest', 'evidence_refs', 'request_identity', 'detail_digest', 'macro_impact_digest'}
    if set(authority) != required:
        raise ValueError('detailer replan authority fields invalid')
    task_id, revision, slug = str(authority['task_id']), int(authority['task_revision']), str(authority['plan_slug'])
    if proposal.mode != 'detailer_replan' or proposal.aggregate_result != 'replan_required' or proposal.result != 'task_set_replanned':
        raise ValueError('detailer replan proposal mode or result invalid')
    if proposal.expected_plan_revision != authority['expected_plan_revision'] or proposal.task_or_task_set_id != task_id or proposal.task_or_task_set_revision != revision or proposal.closure_evidence_digest != authority['closure_evidence_digest']:
        raise ValueError('detailer replan proposal authority mismatch')
    if any(ref not in proposal.evidence_refs for ref in authority['evidence_refs']):
        raise ValueError('detailer replan proposal omits authority evidence ref')
    root = Path(context.project.project_root)
    plan_root = root / 'docs' / 'plantree' / 'plans' / slug
    if not plan_root.is_dir():
        raise ValueError('detailer replan plan root missing')
    if current_plan_revision(context, slug) != authority['expected_plan_revision']:
        raise ValueError('detailer replan plan revision conflict')
    state_root = plan_root / 'tasks' / task_id / 'planner-replan'
    state_root.mkdir(parents=True, exist_ok=True)
    tx_path = state_root / f'backfill-r{revision}.transaction.json'
    backfill_path = state_root / f'backfill-r{revision}.json'
    lock_path = state_root / f'backfill-r{revision}.lock'
    with file_lock(lock_path):
        feedback_digest = planner_feedback_digest(proposal)
        identity = {'task_id': task_id, 'task_revision': revision, 'planner_job_id': planner_job_id, 'planner_feedback_digest': feedback_digest, 'authority': authority}
        transaction = {'schema': 'ccb.plan.detailer_replan_backfill_transaction.v1', 'identity': identity}
        transaction['transaction_digest'] = _digest(transaction)
        if tx_path.is_file():
            existing = _read(tx_path)
            if existing != transaction:
                raise ValueError('detailer replan transaction authority conflict')
        else:
            atomic_write_json(tx_path, transaction)
        record = {'schema': 'ccb.plan.detailer_replan_backfill.v1', 'authority': authority, 'proposal': proposal.to_record(), 'planner_job_id': planner_job_id, 'transaction_path': str(tx_path.relative_to(root)), 'transaction_digest': transaction['transaction_digest']}
        record['backfill_digest'] = _digest(record)
        if backfill_path.is_file():
            if _read(backfill_path) != record:
                raise ValueError('detailer replan backfill conflicts with persisted authority')
            return {'backfill_path': str(backfill_path.relative_to(root)), 'transaction_path': str(tx_path.relative_to(root)), 'backfill_digest': record['backfill_digest'], 'idempotent': True}
        # The proposal itself is durable PlanTree evidence. Semantic PlanTree edits
        # remain fenced by this transaction instead of being inferred from prose.
        atomic_write_json(backfill_path, record)
        return {'backfill_path': str(backfill_path.relative_to(root)), 'transaction_path': str(tx_path.relative_to(root)), 'backfill_digest': record['backfill_digest'], 'idempotent': False}


def _read(path: Path) -> dict[str, object]:
    value = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(value, dict):
        raise ValueError('detailer replan durable record must be an object')
    return value


def _digest(value: object) -> str:
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
    return 'sha256:' + hashlib.sha256(payload).hexdigest()
