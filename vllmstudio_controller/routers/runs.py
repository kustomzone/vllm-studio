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

    old_recipe_id = getattr(request.app.state, "current_recipe_id", None)

    lock = getattr(request.app.state, "switch_lock", None)
    if lock is None:
        ok, pid, detail = await launcher.switch(recipe, force=req.force)
    elif lock.locked():
        return {"success": False, "message": "switch in progress", "new_recipe": recipe.id}
    else:
        async with lock:
            ok, pid, detail = await launcher.switch(recipe, force=req.force)

    if ok:
        request.app.state.current_recipe_id = recipe.id
    return {
        "success": ok,
        "message": detail or ("switched" if ok else "switch failed"),
        "old_recipe": old_recipe_id,
        "new_recipe": recipe.id,
        "pid": pid,
    }


@router.post("/evict")
async def evict(
    request: Request,
    force: bool = False,
    _p=Depends(require_scope("runs:write")),
    launcher: Launcher = Depends(get_launcher),
):
    old_recipe_id = getattr(request.app.state, "current_recipe_id", None)
    pid = await launcher.evict(force=force)
    request.app.state.current_recipe_id = None
    return {"status": "evicted", "model": old_recipe_id, "pid": pid}
