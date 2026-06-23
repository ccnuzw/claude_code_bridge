from __future__ import annotations

import os
import sqlite3
import time
from pathlib import Path


TRIGGER_NAME = 'ccb_drop_diagnostic_logs'
TRIGGER_SQL = f'''
CREATE TRIGGER {TRIGGER_NAME}
BEFORE INSERT ON logs
WHEN lower(NEW.level) IN ('trace', 'debug')
BEGIN
    SELECT RAISE(IGNORE);
END
'''.strip()


def codex_diagnostic_logs_enabled() -> bool:
    raw = str(os.environ.get('CCB_CODEX_DIAGNOSTIC_LOGS') or '').strip().lower()
    return raw in {'1', 'true', 'yes', 'on'}


def ensure_codex_diagnostic_log_filter(codex_home: Path) -> bool:
    """Ensure the managed Codex diagnostic-log policy is applied.

    Codex creates logs_2.sqlite lazily, so callers should treat False as "not
    settled yet" and retry later if the process is still starting or the
    database is temporarily locked.
    """
    if codex_diagnostic_logs_enabled():
        return remove_codex_diagnostic_log_filter(codex_home)
    return install_codex_diagnostic_log_filter(codex_home)


def install_codex_diagnostic_log_filter(codex_home: Path) -> bool:
    """Drop Codex diagnostic rows from CCB-managed Codex homes.

    Returns True when the trigger is present after the call. Missing lazy-created
    Codex databases return False so long-lived callers can retry later.
    """
    db_path = Path(codex_home).expanduser() / 'logs_2.sqlite'
    if not db_path.is_file():
        return False
    try:
        with sqlite3.connect(str(db_path), timeout=0.2) as conn:
            if not _logs_table_exists(conn):
                return False
            current_sql = _trigger_sql(conn)
            if _trigger_sql_matches(current_sql):
                return True
            if current_sql is not None:
                conn.execute(f'DROP TRIGGER IF EXISTS {TRIGGER_NAME}')
            conn.execute(TRIGGER_SQL)
            conn.commit()
        return True
    except sqlite3.Error:
        return False


def remove_codex_diagnostic_log_filter(codex_home: Path) -> bool:
    """Remove CCB's Codex diagnostic-log filter when diagnostics are enabled."""
    db_path = Path(codex_home).expanduser() / 'logs_2.sqlite'
    if not db_path.is_file():
        return True
    try:
        with sqlite3.connect(str(db_path), timeout=0.2) as conn:
            if _trigger_sql(conn) is None:
                return True
            conn.execute(f'DROP TRIGGER IF EXISTS {TRIGGER_NAME}')
            conn.commit()
        return True
    except sqlite3.Error:
        return False


def ensure_codex_diagnostic_log_filter_from_env() -> bool:
    raw = str(os.environ.get('CODEX_SQLITE_HOME') or os.environ.get('CODEX_HOME') or '').strip()
    if not raw:
        return False
    return ensure_codex_diagnostic_log_filter(Path(raw))


def install_codex_diagnostic_log_filter_from_env() -> bool:
    raw = str(os.environ.get('CODEX_SQLITE_HOME') or os.environ.get('CODEX_HOME') or '').strip()
    if not raw:
        return False
    return install_codex_diagnostic_log_filter(Path(raw))


class CodexDiagnosticLogFilterInstaller:
    def __init__(self, interval_s: float = 5.0) -> None:
        self._ensured = False
        self._next_attempt = 0.0
        self._interval_s = max(0.1, float(interval_s))

    def maybe_install(self) -> bool:
        if self._ensured:
            return True
        now = time.monotonic()
        if now < self._next_attempt:
            return False
        self._next_attempt = now + self._interval_s
        self._ensured = ensure_codex_diagnostic_log_filter_from_env()
        return self._ensured


def _logs_table_exists(conn: sqlite3.Connection) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='logs' LIMIT 1"
    ).fetchone()
    return row is not None


def _trigger_sql(conn: sqlite3.Connection) -> str | None:
    row = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type='trigger' AND name=? LIMIT 1",
        (TRIGGER_NAME,),
    ).fetchone()
    if row is None:
        return None
    return str(row[0] or '').strip() or None


def _trigger_sql_matches(sql: str | None) -> bool:
    if not sql:
        return False
    normalized = ' '.join(sql.lower().split())
    compact = ''.join(sql.lower().split())
    return (
        f'create trigger {TRIGGER_NAME}' in normalized
        and 'before insert on logs' in normalized
        and 'when lower(new.level) in' in normalized
        and "'trace','debug'" in compact
        and 'raise(ignore)' in compact
    )


__all__ = [
    'CodexDiagnosticLogFilterInstaller',
    'TRIGGER_NAME',
    'codex_diagnostic_logs_enabled',
    'ensure_codex_diagnostic_log_filter',
    'ensure_codex_diagnostic_log_filter_from_env',
    'install_codex_diagnostic_log_filter',
    'install_codex_diagnostic_log_filter_from_env',
    'remove_codex_diagnostic_log_filter',
]
