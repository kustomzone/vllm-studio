"""Tiny HTTP proxy helpers (used for OpenAI passthrough endpoints)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import AsyncIterator, Dict, Optional

import httpx


@dataclass(frozen=True)
class ProxiedResponse:
    status_code: int
    headers: Dict[str, str]
    content_type: str
    body: Optional[bytes] = None
    stream: Optional[AsyncIterator[bytes]] = None


async def post_streaming(
    url: str,
    *,
    body: bytes,
    headers: Dict[str, str],
    timeout: Optional[float] = None,
) -> ProxiedResponse:
    """POST `body` to `url`, returning either full body or a streaming iterator."""
    client = httpx.AsyncClient(timeout=timeout)
    request = client.build_request("POST", url, content=body, headers=headers)
    response = await client.send(request, stream=True)

    content_type = response.headers.get("content-type", "application/octet-stream")
    normalized_headers = {k: v for k, v in response.headers.items()}

    if "text/event-stream" in content_type and response.status_code < 400:
        async def _stream() -> AsyncIterator[bytes]:
            try:
                async for chunk in response.aiter_raw():
                    yield chunk
            finally:
                await response.aclose()
                await client.aclose()

        return ProxiedResponse(
            status_code=response.status_code,
            headers=normalized_headers,
            content_type=content_type,
            stream=_stream(),
        )

    data = await response.aread()
    await response.aclose()
    await client.aclose()
    return ProxiedResponse(
        status_code=response.status_code,
        headers=normalized_headers,
        content_type=content_type,
        body=data,
    )

