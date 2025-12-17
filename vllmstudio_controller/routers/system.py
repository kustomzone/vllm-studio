from __future__ import annotations

from fastapi import APIRouter, Depends

from ..deps import get_inference_port, require_scope
from ..services import find_current_inference_process


router = APIRouter(tags=["system"])


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/status")
async def status(
    _p=Depends(require_scope("inference:read")),
    inference_port: int = Depends(get_inference_port),
):
    current = find_current_inference_process(inference_port)
    return {"inference_port": inference_port, "running_process": current.__dict__ if current else None}
