from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import StreamingResponse

from ..http import post_streaming
from ..deps import get_proxy_base, require_scope


router = APIRouter(tags=["passthrough"])


@router.post("/v1/messages")
async def anthropic_passthrough(
    request: Request,
    _p=Depends(require_scope("inference:write")),
    proxy_base: str = Depends(get_proxy_base),
):
    body = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() not in {"host", "content-length"}}
    proxied = await post_streaming(f"{proxy_base}/v1/messages", body=body, headers=headers, timeout=None)
    if proxied.stream is not None:
        return StreamingResponse(proxied.stream, status_code=proxied.status_code, media_type=proxied.content_type)
    return Response(content=proxied.body or b"", status_code=proxied.status_code, media_type=proxied.content_type)
