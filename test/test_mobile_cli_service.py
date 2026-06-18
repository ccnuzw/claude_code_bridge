from __future__ import annotations

import pytest

from cli.services.mobile import _public_gateway_url


def test_public_gateway_url_defaults_to_loopback_fallback() -> None:
    assert (
        _public_gateway_url(None, fallback='http://127.0.0.1:8787')
        == 'http://127.0.0.1:8787'
    )
    assert (
        _public_gateway_url('', fallback='http://127.0.0.1:8787')
        == 'http://127.0.0.1:8787'
    )


def test_public_gateway_url_accepts_origin_only() -> None:
    assert (
        _public_gateway_url('https://mobile.example.com', fallback='unused')
        == 'https://mobile.example.com'
    )
    assert (
        _public_gateway_url('https://mobile.example.com/', fallback='unused')
        == 'https://mobile.example.com'
    )
    assert (
        _public_gateway_url('https://mobile.example.com:8443', fallback='unused')
        == 'https://mobile.example.com:8443'
    )


@pytest.mark.parametrize(
    ('value', 'message'),
    [
        ('mobile.example.com', 'absolute http\\(s\\) origin URL'),
        ('ftp://mobile.example.com', 'absolute http\\(s\\) origin URL'),
        ('https://mobile.example.com/pair', 'must not include a path'),
        ('https://mobile.example.com?debug=1', 'params, query, or fragment'),
        ('https://mobile.example.com#pair', 'params, query, or fragment'),
        ('https://user:pass@mobile.example.com', 'must not include credentials'),
        ('https://mobile.example.com:bad', 'port must be valid'),
    ],
)
def test_public_gateway_url_rejects_non_origin_url(value: str, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        _public_gateway_url(value, fallback='unused')
