from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException

from ..deps import require_scope


router = APIRouter(tags=["compat"])


@router.get("/skills")
async def list_skills(_p=Depends(require_scope("skills:read"))):
    return []


@router.post("/skills/{skill_id}")
async def run_skill(skill_id: str, _payload: Dict[str, Any], _p=Depends(require_scope("skills:write"))):
    raise HTTPException(status_code=501, detail=f"Skills not implemented (skill_id={skill_id})")

