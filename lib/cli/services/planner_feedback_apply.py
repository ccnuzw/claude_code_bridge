from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re

from storage.atomic import atomic_write_json, atomic_write_text
from storage.locks import file_lock

from .planner_feedback import PlannerBackfillProposal, planner_feedback_digest


_DIGEST_RE = re.compile(r'^sha256:[0-9a-f]{64}$')
_FILES = ('README.md', 'Roadmap.md', 'TODO.md')


def current_plan_revision(context, plan_slug: str) -> str:
    root = _plan_root(context, plan_slug)
    files = []
    for name in ('README.md', 'brief.md', 'Roadmap.md', 'roadmap.md', 'TODO.md', 'todo.md'):
        path = root / name
        if path.is_file():
            files.append({'path': str(path.relative_to(context.project.project_root)), 'sha256': _file_sha(path)})
    return _digest({'schema': 'ccb.plan.revision.v1', 'files': files})


def apply_planner_feedback(
    context,
    proposal: PlannerBackfillProposal,
    authority: dict[str, object],
) -> dict[str, object]:
    """Apply a Planner-authored projection using a replayable preimage/target transaction."""
    normalized = _authority(proposal, authority)
    plan_root = _plan_root(context, normalized['plan_slug'])
    task_set_root = plan_root / 'task-sets' / normalized['task_set_id']
    task_set_path = task_set_root / 'task-set.json'
    closure_path = task_set_root / 'closure.json'
    task_set = _read_json(task_set_path)
    closure = _read_json(closure_path)
    _validate_source_authority(task_set, closure, proposal, normalized)
    task_set_root.mkdir(parents=True, exist_ok=True)
    tx_path = task_set_root / 'planner-backfill.transaction.json'
    backfill_path = task_set_root / 'planner-backfill.json'
    with file_lock(task_set_root / 'planner-backfill.lock'):
        if backfill_path.is_file():
            existing = _read_json(backfill_path)
            expected = _backfill_record(proposal, normalized)
            if any(existing.get(key) != value for key, value in expected.items()):
                raise ValueError('planner backfill conflicts with persisted authority')
            return _result(backfill_path, tx_path, existing, idempotent=True)

        transaction = _read_json(tx_path) if tx_path.is_file() else None
        if transaction is None:
            observed_revision = current_plan_revision(context, normalized['plan_slug'])
            if observed_revision != normalized['expected_plan_revision']:
                raise ValueError('planner backfill plan revision conflict')
            transaction = _prepare_transaction(context, plan_root, proposal, normalized)
            atomic_write_json(tx_path, transaction)
        else:
            _validate_transaction(transaction, normalized)

        _apply_targets(context, transaction)
        observed_target = current_plan_revision(context, normalized['plan_slug'])
        if observed_target != transaction['target_plan_revision']:
            raise ValueError('planner backfill target revision conflict')
        record = _backfill_record(proposal, normalized)
        record['target_plan_revision'] = observed_target
        record['transaction_path'] = str(tx_path.relative_to(context.project.project_root))
        atomic_write_json(backfill_path, record)
        return _result(backfill_path, tx_path, record, idempotent=False)


def _prepare_transaction(context, plan_root: Path, proposal, authority) -> dict[str, object]:
    targets = []
    sections = _sections(proposal)
    for name in _FILES:
        path = plan_root / name
        before = path.read_text(encoding='utf-8') if path.is_file() else ''
        after = _replace_marker(before, authority['task_set_id'], name, sections[name])
        targets.append({
            'path': str(path.relative_to(context.project.project_root)),
            'preimage_digest': _text_digest(before),
            'target_digest': _text_digest(after),
            'target_text': after,
        })
    projected = {item['path']: item['target_text'] for item in targets}
    revision_files = []
    for name in ('README.md', 'brief.md', 'Roadmap.md', 'roadmap.md', 'TODO.md', 'todo.md'):
        path = plan_root / name
        relative = str(path.relative_to(context.project.project_root))
        if relative in projected or path.is_file():
            text = projected[relative] if relative in projected else path.read_text(encoding='utf-8')
            revision_files.append({'path': relative, 'sha256': hashlib.sha256(text.encode()).hexdigest()})
    target_revision = _digest({'schema': 'ccb.plan.revision.v1', 'files': revision_files})
    return {
        'schema': 'ccb.plan.planner_backfill_transaction.v1',
        'task_set_id': authority['task_set_id'],
        'task_set_revision': authority['task_set_revision'],
        'planner_feedback_digest': authority['planner_feedback_digest'],
        'preimage_plan_revision': authority['expected_plan_revision'],
        'target_plan_revision': target_revision,
        'targets': targets,
    }


def _apply_targets(context, transaction: dict[str, object]) -> None:
    root = Path(context.project.project_root).resolve()
    for item in transaction['targets']:
        path = (root / item['path']).resolve()
        if path != root and root not in path.parents:
            raise ValueError('planner backfill target escapes project root')
        current = path.read_text(encoding='utf-8') if path.is_file() else ''
        digest = _text_digest(current)
        if digest == item['target_digest']:
            continue
        if digest != item['preimage_digest']:
            raise ValueError(f'planner backfill file revision conflict: {item["path"]}')
        atomic_write_text(path, item['target_text'])


def _sections(proposal: PlannerBackfillProposal) -> dict[str, str]:
    refs = [*proposal.decision_refs, *proposal.open_question_refs, *proposal.evidence_refs]
    brief = '\n'.join([f'### Planner closure: {proposal.task_or_task_set_id}', proposal.brief_summary,
                       f'- Result: `{proposal.result}`', f'- Next milestone: `{proposal.next_milestone["ref"]}`',
                       *[f'- Reference: `{value}`' for value in refs]])
    def transitions(title: str, values) -> str:
        lines = [title]
        for item in values:
            lines.extend((f'### {item["id"]}', f'- Status: `{item["status"]}`', str(item['summary'])))
            lines.extend(f'- Evidence: `{ref}`' for ref in item['evidence_refs'])
        return '\n'.join(lines)
    return {'README.md': brief, 'Roadmap.md': transitions('## Planner closure transitions', proposal.roadmap_transitions),
            'TODO.md': transitions('## Planner closure TODO transitions', proposal.todo_transitions)}


def _replace_marker(text: str, identity: str, name: str, body: str) -> str:
    kind = {'README.md': 'brief', 'Roadmap.md': 'roadmap', 'TODO.md': 'todo'}[name]
    start = f'<!-- ccb-planner-backfill:{identity}:{kind}:start -->'
    end = f'<!-- ccb-planner-backfill:{identity}:{kind}:end -->'
    block = f'{start}\n{body.rstrip()}\n{end}'
    pattern = re.compile(re.escape(start) + r'.*?' + re.escape(end), re.DOTALL)
    if pattern.search(text):
        return pattern.sub(block, text)
    prefix = text.rstrip()
    return (prefix + '\n\n' if prefix else '') + block + '\n'


def _authority(proposal, value: dict[str, object]) -> dict[str, object]:
    required = ('task_set_id', 'task_set_revision', 'closure_intent_id', 'closure_digest',
                'ordered_terminal_evidence_digest', 'expected_plan_revision', 'planner_job_id',
                'planner_feedback_digest', 'plan_slug')
    if set(value) != set(required):
        raise ValueError('planner backfill authority fields invalid')
    result = dict(value)
    for field in ('closure_digest', 'ordered_terminal_evidence_digest', 'expected_plan_revision', 'planner_feedback_digest'):
        if not _DIGEST_RE.fullmatch(str(result[field])):
            raise ValueError(f'planner backfill {field} invalid')
    if result['planner_feedback_digest'] != planner_feedback_digest(proposal):
        raise ValueError('planner backfill proposal digest mismatch')
    return result


def _validate_source_authority(task_set, closure, proposal, authority) -> None:
    expected = {
        'task_set_id': authority['task_set_id'], 'task_set_revision': authority['task_set_revision'],
        'ordered_terminal_evidence_digest': authority['ordered_terminal_evidence_digest'],
        'closure_digest': authority['closure_digest'], 'aggregate_result': proposal.aggregate_result,
    }
    actual = {key: closure.get(key) for key in expected}
    if actual != expected or task_set.get('task_set_id') != authority['task_set_id'] or task_set.get('task_set_revision') != authority['task_set_revision']:
        raise ValueError('planner backfill task-set closure authority mismatch')
    if task_set.get('state') != 'closure_pending':
        raise ValueError('planner backfill task set is not closure_pending')
    if (task_set.get('plan_revision') or {}).get('digest') != authority['expected_plan_revision']:
        raise ValueError('planner backfill expected plan revision mismatch')
    proposal_expected = {
        'task_or_task_set_id': authority['task_set_id'],
        'task_or_task_set_revision': authority['task_set_revision'],
        'closure_evidence_digest': authority['ordered_terminal_evidence_digest'],
        'expected_plan_revision': authority['expected_plan_revision'],
        'aggregate_result': closure['aggregate_result'],
    }
    if any(getattr(proposal, key) != expected_value for key, expected_value in proposal_expected.items()):
        raise ValueError('planner backfill proposal authority mismatch')
    closure_ref = f'docs/plantree/plans/{authority["plan_slug"]}/task-sets/{authority["task_set_id"]}/closure.json'
    if closure_ref not in proposal.evidence_refs:
        raise ValueError('planner backfill required closure evidence ref missing')


def _backfill_record(proposal, authority) -> dict[str, object]:
    record = {'schema': 'ccb.plan.planner_backfill.v1', **authority, 'aggregate_result': proposal.aggregate_result,
              'result': proposal.result, 'proposal': proposal.to_record()}
    return json.loads(json.dumps(record, sort_keys=True))


def _validate_transaction(tx, authority) -> None:
    expected = {key: authority[key] for key in ('task_set_id', 'task_set_revision', 'planner_feedback_digest')}
    if tx.get('schema') != 'ccb.plan.planner_backfill_transaction.v1' or any(tx.get(k) != v for k, v in expected.items()):
        raise ValueError('planner backfill transaction authority conflict')


def _result(backfill_path, tx_path, record, *, idempotent):
    return {'status': 'imported', 'idempotent': idempotent,
            'planner_backfill_path': str(backfill_path), 'transaction_path': str(tx_path),
            'target_plan_revision': record.get('target_plan_revision')}


def _plan_root(context, slug) -> Path:
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,79}', str(slug or '')):
        raise ValueError('planner backfill plan_slug invalid')
    path = Path(context.project.project_root) / 'docs/plantree/plans' / str(slug)
    if not path.is_dir():
        raise ValueError('planner backfill plan root missing')
    return path


def _read_json(path):
    try:
        value = json.loads(path.read_text(encoding='utf-8'))
    except (FileNotFoundError, json.JSONDecodeError) as exc:
        raise ValueError(f'planner backfill authority unreadable: {path}') from exc
    if not isinstance(value, dict):
        raise ValueError(f'planner backfill authority is not object: {path}')
    return value


def _file_sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def _text_digest(text): return 'sha256:' + hashlib.sha256(text.encode('utf-8')).hexdigest()
def _digest(value): return 'sha256:' + hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


__all__ = ['apply_planner_feedback', 'current_plan_revision']
