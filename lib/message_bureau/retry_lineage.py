from __future__ import annotations

from dataclasses import dataclass

from storage.paths import PathLayout

from .model_enums import AttemptState
from .store import AttemptStore, MessageStore


_TERMINAL_NON_SUCCESS = frozenset({
    AttemptState.INCOMPLETE,
    AttemptState.FAILED,
    AttemptState.CANCELLED,
    AttemptState.SUPERSEDED,
    AttemptState.DEAD_LETTER,
})


class RetryLineageError(ValueError):
    pass


@dataclass(frozen=True)
class RetrySuccessorEdge:
    message_id: str
    source_attempt_id: str
    successor_attempt_id: str
    retry_source_job_id: str
    retry_successor_job_id: str
    retry_index: int

    def to_record(self) -> dict[str, object]:
        return {
            'message_id': self.message_id,
            'source_attempt_id': self.source_attempt_id,
            'successor_attempt_id': self.successor_attempt_id,
            'retry_source_job_id': self.retry_source_job_id,
            'retry_successor_job_id': self.retry_successor_job_id,
            'retry_index': self.retry_index,
        }


def authoritative_retry_successor(layout: PathLayout, source_job_id: str) -> RetrySuccessorEdge | None:
    attempts = AttemptStore(layout)
    source = attempts.get_latest_by_job_id(source_job_id)
    if source is None:
        raise RetryLineageError('retry source attempt authority missing')
    message = MessageStore(layout).get_latest(source.message_id)
    if message is None:
        raise RetryLineageError('retry source message authority missing')
    if source.attempt_state not in _TERMINAL_NON_SUCCESS:
        raise RetryLineageError('retry source attempt is not terminal non-success')

    latest = {}
    for attempt in attempts.list_message(source.message_id):
        latest[attempt.attempt_id] = attempt
    candidates = [
        attempt for attempt in latest.values()
        if attempt.agent_name == source.agent_name
        and attempt.retry_index == source.retry_index + 1
    ]
    if len(candidates) > 1:
        raise RetryLineageError('retry successor attempt authority ambiguous')
    if not candidates:
        return None
    successor = candidates[0]
    max_attempts = int((message.retry_policy or {}).get('max_attempts') or 1)
    if max_attempts < 1 or successor.retry_index >= max_attempts:
        raise RetryLineageError('retry successor exceeds message retry policy')
    if successor.job_id == source.job_id:
        raise RetryLineageError('retry successor job matches source job')
    return RetrySuccessorEdge(
        message_id=source.message_id,
        source_attempt_id=source.attempt_id,
        successor_attempt_id=successor.attempt_id,
        retry_source_job_id=source.job_id,
        retry_successor_job_id=successor.job_id,
        retry_index=successor.retry_index,
    )


__all__ = ['RetryLineageError', 'RetrySuccessorEdge', 'authoritative_retry_successor']
