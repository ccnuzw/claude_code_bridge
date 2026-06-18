from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse, urlunsplit

from ccbd.socket_client import CcbdClient
from mobile_gateway import (
    MobileGatewayPairingStore,
    MobileGatewayService,
    build_mobile_gateway_server,
    parse_listen_address,
)


@dataclass(frozen=True)
class MobileGatewayServeHandle:
    summary: dict[str, object]
    server: object

    def serve_forever(self) -> None:
        self.server.serve_forever()

    def close(self) -> None:
        self.server.server_close()


def prepare_mobile_gateway(context, command) -> MobileGatewayServeHandle:
    listen = parse_listen_address(command.listen)
    service = MobileGatewayService(
        project_id=context.project.project_id,
        project_root=context.project.project_root,
        ccbd_client_factory=lambda: CcbdClient(context.paths.ccbd_socket_path),
        mobile_dir=context.paths.ccbd_mobile_dir,
    )
    server = build_mobile_gateway_server(listen, service)
    host, port = server.server_address[:2]
    local_gateway_url = f'http://{host}:{port}'
    gateway_url = _public_gateway_url(command.public_url, fallback=local_gateway_url)
    route_provider = str(command.route_provider or 'lan')
    pairing = service.create_pairing_payload(gateway_url=gateway_url, route_provider=route_provider)
    return MobileGatewayServeHandle(
        summary={
            'mobile_status': 'serving',
            'listen': f'{host}:{port}',
            'gateway_url': gateway_url,
            'local_gateway_url': local_gateway_url,
            'route_provider': route_provider,
            'project_id': context.project.project_id,
            'project_root': str(context.project.project_root),
            'mode': 'loopback_current_project',
            'pairing': pairing,
            'endpoints': [
                '/v1/health',
                '/v1/projects',
                '/v1/projects/{project_id}/view',
                '/v1/pairing/claim',
                '/v1/devices/me',
                '/v1/devices/{device_id}/revoke',
                '/v1/projects/{project_id}/focus-agent',
                '/v1/projects/{project_id}/focus-window',
                '/v1/projects/{project_id}/terminals',
                '/v1/terminals/{terminal_id}',
            ],
        },
        server=server,
    )


def mobile_devices_status(context, command) -> dict[str, object]:
    store = MobileGatewayPairingStore(context.paths.ccbd_mobile_dir)
    return {
        'mobile_status': 'devices',
        'project_id': context.project.project_id,
        'project_root': str(context.project.project_root),
        'mobile_state_dir': str(context.paths.ccbd_mobile_dir),
        'devices': store.list_devices(),
    }


def revoke_mobile_device(context, command) -> dict[str, object]:
    device_id = str(getattr(command, 'device_id', '') or '').strip()
    store = MobileGatewayPairingStore(context.paths.ccbd_mobile_dir)
    result = store.revoke_device_locally(device_id=device_id)
    return {
        'mobile_status': 'revoked',
        'project_id': context.project.project_id,
        'project_root': str(context.project.project_root),
        'mobile_state_dir': str(context.paths.ccbd_mobile_dir),
        **result,
    }


def _public_gateway_url(value: str | None, *, fallback: str) -> str:
    text = str(value or '').strip()
    if not text:
        return fallback
    parsed = urlparse(text)
    if parsed.scheme not in {'http', 'https'} or not parsed.netloc or not parsed.hostname:
        raise ValueError('--public-url must be an absolute http(s) origin URL')
    try:
        parsed.port
    except ValueError as exc:
        raise ValueError('--public-url port must be valid') from exc
    if parsed.username or parsed.password:
        raise ValueError('--public-url must not include credentials')
    if parsed.path not in {'', '/'}:
        raise ValueError('--public-url must not include a path')
    if parsed.params or parsed.query or parsed.fragment:
        raise ValueError('--public-url must not include params, query, or fragment')
    return urlunsplit((parsed.scheme, parsed.netloc, '', '', ''))


__all__ = [
    'MobileGatewayServeHandle',
    'mobile_devices_status',
    'prepare_mobile_gateway',
    'revoke_mobile_device',
]
