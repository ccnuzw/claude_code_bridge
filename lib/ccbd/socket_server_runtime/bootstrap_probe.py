from __future__ import annotations

from contextlib import contextmanager
import os
from pathlib import Path
import select
import socket
import tempfile
import time
import uuid

from ccbd.api_models import RpcRequest
from ccbd.socket_client_runtime import decode_response, send_request

from .loop import close_connection, enqueue_connection, start_worker


_MAX_RESPONSE_BYTES = 1024 * 1024
_MAX_DEFERRED_CONNECTIONS = 128


@contextmanager
def bootstrap_readiness_probe(server, *, timeout_s: float):
    """Prove the bound socket and normal request worker before mounted publish."""

    runtime_socket = server._server
    if runtime_socket is None:
        raise RuntimeError('ccbd bootstrap probe requires a listening socket')
    if server._bootstrap_probe_active:
        raise RuntimeError('ccbd bootstrap probe is already active')
    deadline = time.monotonic() + max(0.1, float(timeout_s))
    nonce = uuid.uuid4().hex
    client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    client_path = _probe_client_path(nonce)
    client_socket_stat = None
    server._bootstrap_probe_active = True
    completed = False
    try:
        start_worker(server, interval=0.0, on_tick=None)
        client.settimeout(max(0.1, deadline - time.monotonic()))
        client.bind(str(client_path))
        client_socket_stat = _path_identity(client_path)
        client.connect(str(server._socket_path))
        send_request(
            client,
            RpcRequest(
                op='ping',
                request={
                    'target': 'ccbd',
                    'bootstrap_probe_nonce': nonce,
                },
            ),
        )
        payload = _pump_until_probe_response(
            server,
            runtime_socket=runtime_socket,
            client=client,
            deadline=deadline,
            nonce=nonce,
            probe_client_path=client_path,
        )
        # Keep the bootstrap-only request gate active through the caller's
        # identity validation and mounted commit.
        yield payload
        completed = True
    except BaseException:
        # Do not reopen the normal RPC surface between a failed probe/identity
        # check and the caller's mandatory shutdown cleanup.  Otherwise an
        # already queued mutating request could execute without mounted
        # authority in that narrow unwind window.
        server._stop_event.set()
        raise
    finally:
        if completed:
            server._bootstrap_probe_active = False
        try:
            client.close()
        except OSError:
            pass
        _unlink_probe_client_path(
            client_path,
            expected_identity=client_socket_stat,
        )


def _pump_until_probe_response(
    server,
    *,
    runtime_socket,
    client,
    deadline: float,
    nonce: str,
    probe_client_path: Path,
) -> dict:
    raw = b''
    deferred_connections = []
    try:
        while b'\n' not in raw:
            worker_error = server._peek_worker_error()
            if worker_error is not None:
                raise RuntimeError(f'ccbd bootstrap request worker failed: {worker_error}')
            if server._stop_event.is_set():
                raise RuntimeError('ccbd bootstrap request worker stopped')
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError('timed out waiting for ccbd bootstrap self-ping')
            readable, _, _ = select.select(
                [runtime_socket, client],
                [],
                [],
                remaining,
            )
            if runtime_socket in readable:
                try:
                    conn, peer_path = runtime_socket.accept()
                except (BlockingIOError, socket.timeout):
                    conn = None
                    peer_path = None
                if conn is not None:
                    if _same_peer_path(peer_path, probe_client_path):
                        enqueue_connection(server, conn)
                    elif len(deferred_connections) >= _MAX_DEFERRED_CONNECTIONS:
                        close_connection(conn)
                    else:
                        deferred_connections.append(conn)
            if client in readable:
                chunk = client.recv(65536)
                if not chunk:
                    break
                raw += chunk
                if len(raw) > _MAX_RESPONSE_BYTES:
                    raise RuntimeError('ccbd bootstrap self-ping response is too large')
        if not raw:
            raise RuntimeError('ccbd bootstrap self-ping returned an empty response')
        response = decode_response(raw)
        if not response.ok:
            raise RuntimeError(response.error or 'ccbd bootstrap self-ping failed')
        payload = dict(response.payload)
        if str(payload.get('bootstrap_probe_nonce') or '') != nonce:
            raise RuntimeError('ccbd bootstrap self-ping nonce mismatch')
    except BaseException:
        for connection in deferred_connections:
            close_connection(connection)
        raise
    for connection in deferred_connections:
        enqueue_connection(server, connection)
    return payload


def _probe_client_path(nonce: str) -> Path:
    name = f'ccb-probe-{os.getpid()}-{nonce[:12]}.sock'
    candidate = Path(tempfile.gettempdir()) / name
    if len(os.fsencode(candidate)) < 96:
        return candidate
    return Path('/tmp') / name


def _same_peer_path(peer_path, expected: Path) -> bool:
    try:
        return os.path.abspath(os.fsdecode(peer_path)) == os.path.abspath(str(expected))
    except (TypeError, ValueError):
        return False


def _path_identity(path: Path) -> tuple[int, int] | None:
    try:
        record = os.stat(path)
    except OSError:
        return None
    return int(record.st_dev), int(record.st_ino)


def _unlink_probe_client_path(
    path: Path,
    *,
    expected_identity: tuple[int, int] | None,
) -> None:
    if expected_identity is None or _path_identity(path) != expected_identity:
        return
    try:
        path.unlink()
    except FileNotFoundError:
        return


__all__ = ['bootstrap_readiness_probe']
