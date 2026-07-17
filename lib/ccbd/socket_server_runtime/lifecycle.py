from __future__ import annotations

import errno
import os
import socket
import stat
import time

_LISTEN_BACKLOG = 128


def listen_server(server) -> None:
    if server._server is not None:
        return
    if not hasattr(socket, 'AF_UNIX'):
        raise RuntimeError('unix domain sockets are not supported on this platform')
    server._socket_path.parent.mkdir(parents=True, exist_ok=True)
    _remove_stale_socket_path(server._socket_path)
    runtime_socket = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    bound_socket_stat = None
    try:
        runtime_socket.bind(str(server._socket_path))
        bound_socket_stat = _bound_socket_stat(server._socket_path)
        if bound_socket_stat is None:
            raise RuntimeError('ccbd bound socket inode is unavailable')
        runtime_socket.listen(_LISTEN_BACKLOG)
        runtime_socket.settimeout(0.2)
    except BaseException:
        try:
            runtime_socket.close()
        finally:
            _unlink_bound_socket_path(
                server,
                bound_socket_stat=bound_socket_stat,
            )
        raise
    server._reset_worker_error()
    server._server = runtime_socket
    server._bound_socket_stat = bound_socket_stat
    server._stop_event.clear()


def shutdown_server(server) -> None:
    server._stop_event.set()
    bound_socket_stat = server._bound_socket_stat
    if server._server is not None:
        try:
            server._server.close()
        finally:
            server._server = None
    _unlink_bound_socket_path(server, bound_socket_stat=bound_socket_stat)
    server._bound_socket_stat = None
    server._bootstrap_probe_active = False
    server._runtime_bootstrap_active = False


def _bound_socket_stat(path) -> tuple[int, int] | None:
    try:
        stat = os.stat(path)
    except OSError:
        return None
    return int(stat.st_dev), int(stat.st_ino)


def _remove_stale_socket_path(path) -> None:
    try:
        initial = os.lstat(path)
    except FileNotFoundError:
        return
    if not stat.S_ISSOCK(initial.st_mode):
        raise RuntimeError(f'refusing to replace non-socket ccbd path: {path}')
    if _socket_path_connectable(path):
        raise RuntimeError(f'refusing to replace live ccbd socket: {path}')
    try:
        current = os.lstat(path)
    except FileNotFoundError:
        return
    initial_identity = (int(initial.st_dev), int(initial.st_ino))
    current_identity = (int(current.st_dev), int(current.st_ino))
    if current_identity != initial_identity or not stat.S_ISSOCK(current.st_mode):
        raise RuntimeError(f'ccbd socket path changed during stale cleanup: {path}')
    path.unlink()


def _socket_path_connectable(path, *, timeout_s: float = 0.1) -> bool:
    probe = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        probe.settimeout(max(0.01, float(timeout_s)))
        probe.connect(str(path))
        return True
    except FileNotFoundError:
        return False
    except ConnectionRefusedError:
        return False
    except OSError as exc:
        if exc.errno in {errno.ENOENT, errno.ECONNREFUSED}:
            return False
        raise RuntimeError(f'cannot prove existing ccbd socket is stale: {path}: {exc}') from exc
    finally:
        probe.close()


def _unlink_bound_socket_path(
    server,
    *,
    bound_socket_stat: tuple[int, int] | None,
    timeout_s: float = 0.2,
) -> None:
    if bound_socket_stat is None:
        return
    deadline = time.monotonic() + max(0.0, float(timeout_s))
    while True:
        try:
            current = _bound_socket_stat(server._socket_path)
            if current is None or current != bound_socket_stat:
                return
            server._socket_path.unlink()
            return
        except FileNotFoundError:
            return
        except OSError:
            if time.monotonic() >= deadline:
                return
            time.sleep(0.01)


__all__ = ['listen_server', 'shutdown_server']
