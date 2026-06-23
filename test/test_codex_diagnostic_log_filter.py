from __future__ import annotations

import sqlite3
from pathlib import Path

from provider_backends.codex.launcher_runtime.command_runtime.diagnostics import (
    TRIGGER_NAME,
    ensure_codex_diagnostic_log_filter,
    install_codex_diagnostic_log_filter,
)


def _create_logs_db(codex_home: Path) -> Path:
    codex_home.mkdir(parents=True, exist_ok=True)
    db_path = codex_home / 'logs_2.sqlite'
    with sqlite3.connect(str(db_path)) as conn:
        conn.execute(
            '''
            CREATE TABLE logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                level TEXT,
                target TEXT
            )
            '''
        )
    return db_path


def test_install_codex_diagnostic_log_filter_drops_trace_debug_rows(tmp_path: Path) -> None:
    codex_home = tmp_path / 'codex-home'
    db_path = _create_logs_db(codex_home)

    assert install_codex_diagnostic_log_filter(codex_home) is True

    with sqlite3.connect(str(db_path)) as conn:
        conn.execute("INSERT INTO logs(level, target) VALUES ('TRACE', 'trace-row')")
        conn.execute("INSERT INTO logs(level, target) VALUES ('debug', 'debug-row')")
        conn.execute("INSERT INTO logs(level, target) VALUES ('INFO', 'info-row')")
        conn.execute("INSERT INTO logs(level, target) VALUES ('ERROR', 'error-row')")
        rows = conn.execute('SELECT level, target FROM logs ORDER BY id').fetchall()
        trigger = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='trigger' AND name=?",
            (TRIGGER_NAME,),
        ).fetchone()

    assert trigger == (TRIGGER_NAME,)
    assert rows == [('INFO', 'info-row'), ('ERROR', 'error-row')]


def test_install_codex_diagnostic_log_filter_is_schema_noop_when_current(tmp_path: Path) -> None:
    codex_home = tmp_path / 'codex-home'
    db_path = _create_logs_db(codex_home)

    assert install_codex_diagnostic_log_filter(codex_home) is True
    with sqlite3.connect(str(db_path)) as conn:
        schema_version = conn.execute('PRAGMA schema_version').fetchone()[0]

    assert install_codex_diagnostic_log_filter(codex_home) is True

    with sqlite3.connect(str(db_path)) as conn:
        assert conn.execute('PRAGMA schema_version').fetchone()[0] == schema_version


def test_ensure_codex_diagnostic_log_filter_removes_trigger_when_diagnostics_enabled(
    tmp_path: Path,
    monkeypatch,
) -> None:
    codex_home = tmp_path / 'codex-home'
    db_path = _create_logs_db(codex_home)
    assert install_codex_diagnostic_log_filter(codex_home) is True
    monkeypatch.setenv('CCB_CODEX_DIAGNOSTIC_LOGS', '1')

    assert ensure_codex_diagnostic_log_filter(codex_home) is True

    with sqlite3.connect(str(db_path)) as conn:
        trigger = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='trigger' AND name=?",
            (TRIGGER_NAME,),
        ).fetchone()
        conn.execute("INSERT INTO logs(level, target) VALUES ('INFO', 'info-row')")
        rows = conn.execute('SELECT level, target FROM logs ORDER BY id').fetchall()

    assert trigger is None
    assert rows == [('INFO', 'info-row')]


def test_install_codex_diagnostic_log_filter_skips_missing_db(tmp_path: Path) -> None:
    assert install_codex_diagnostic_log_filter(tmp_path / 'missing-home') is False
