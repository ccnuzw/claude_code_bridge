from __future__ import annotations

import json
import socket
import tempfile
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

import pytest

from runtime_accelerator.client import AcceleratorError, call, call_or_fallback, default_socket_path


def test_default_socket_path_uses_project_ccb(tmp_path: Path) -> None:
    assert default_socket_path(tmp_path) == tmp_path / ".ccb" / "runtime-accelerator" / "accelerator.sock"


@pytest.mark.skipif(not hasattr(socket, "AF_UNIX"), reason="requires Unix sockets")
def test_call_reads_accelerator_result() -> None:
    with _short_socket_path() as socket_path:
        done = _serve_once(socket_path, {"ok": True, "result": {"status": "ok"}})

        assert call(socket_path, "ping", {}) == {"status": "ok"}
        done.join(timeout=1)


@pytest.mark.skipif(not hasattr(socket, "AF_UNIX"), reason="requires Unix sockets")
def test_call_or_fallback_uses_python_path_when_sidecar_missing(tmp_path: Path) -> None:
    missing = tmp_path / "missing.sock"

    result = call_or_fallback(missing, "ping", {}, lambda: {"status": "fallback"}, timeout_s=0.01)

    assert result == {"status": "fallback"}


@pytest.mark.skipif(not hasattr(socket, "AF_UNIX"), reason="requires Unix sockets")
def test_call_raises_on_accelerator_error() -> None:
    with _short_socket_path() as socket_path:
        done = _serve_once(socket_path, {"ok": False, "error": "boom"})

        with pytest.raises(AcceleratorError, match="boom"):
            call(socket_path, "ping", {})
        done.join(timeout=1)


@contextmanager
def _short_socket_path() -> Iterator[Path]:
    # macOS AF_UNIX paths are short; GitHub runner tmp_path can exceed the limit.
    base_dir = "/tmp" if Path("/tmp").is_dir() else None
    with tempfile.TemporaryDirectory(prefix="ccb-accel-", dir=base_dir) as directory:
        yield Path(directory) / "a.sock"


def _serve_once(socket_path: Path, response: dict[str, object]) -> threading.Thread:
    listener = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    listener.bind(str(socket_path))
    listener.listen(1)

    def run() -> None:
        try:
            conn, _ = listener.accept()
            with conn:
                conn.recv(4096)
                conn.sendall(json.dumps(response).encode("utf-8") + b"\n")
        finally:
            listener.close()

    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    return thread
