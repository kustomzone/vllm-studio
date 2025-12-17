from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from ..deps import get_launcher, get_store, require_scope
from ..services import Launcher
from ..stores import SQLiteRecipeStore


router = APIRouter(tags=["runs"])


class SwitchRequest(BaseModel):
    recipe_id: str
    force: bool = Field(default=False)


@router.post("/switch")
async def switch(
    req: SwitchRequest,
    request: Request,
    _p=Depends(require_scope("runs:write")),
    store: SQLiteRecipeStore = Depends(get_store),
    launcher: Launcher = Depends(get_launcher),
):
    recipe = store.get(req.recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    lock = getattr(request.app.state, "switch_lock", None)
    if lock is None:
        ok, pid, detail = await launcher.switch(recipe, force=req.force)
    elif lock.locked():
        return {"success": False, "message": "switch in progress"}
    else:
        async with lock:
            ok, pid, detail = await launcher.switch(recipe, force=req.force)

    if ok:
        request.app.state.current_recipe_id = recipe.id
    return {"success": ok, "pid": pid, "detail": detail, "recipe_id": recipe.id}


@router.post("/evict")
async def evict(
    force: bool = False,
    _p=Depends(require_scope("runs:write")),
    launcher: Launcher = Depends(get_launcher),
):
    pid = await launcher.evict(force=force)
    return {"evicted_pid": pid}
