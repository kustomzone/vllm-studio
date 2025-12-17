"""Launch/evict orchestration for inference processes."""

from __future__ import annotations

import asyncio
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Tuple

import psutil

from vllmstudio.backends import get_backend
from vllmstudio.models import Recipe

from .processes import find_current_inference_process


@dataclass(frozen=True)
class Launcher:
    inference_port: int

    async def evict(self, *, force: bool = False) -> Optional[int]:
        current = find_current_inference_process(self.inference_port)
        if not current:
            return None
        await self._kill_tree(current.pid, force=force)
        await asyncio.sleep(2)
        return current.pid

    async def launch(self, recipe: Recipe) -> Tuple[bool, Optional[int], str]:
        backend = get_backend(recipe.backend)
        cmd = backend.build_launch_command(recipe)
        env = os.environ.copy()
        env.update(backend.build_launch_env(recipe))
        log_file = backend.default_log_file(recipe.id)

        try:
            with open(log_file, "w") as log_fh:
                proc = subprocess.Popen(cmd, stdout=log_fh, stderr=subprocess.STDOUT, env=env, start_new_session=True)
            await asyncio.sleep(2)
            if proc.poll() is not None:
                tail = Path(log_file).read_text(errors="ignore")[-500:] if Path(log_file).exists() else ""
                return False, None, f"Exited early. {tail}"
            return True, proc.pid, str(log_file)
        except Exception as e:
            return False, None, str(e)

    async def switch(self, recipe: Recipe, *, force: bool = False) -> Tuple[bool, Optional[int], str]:
        await self.evict(force=force)
        return await self.launch(recipe)

    async def _kill_tree(self, pid: int, *, force: bool) -> None:
        try:
            proc = psutil.Process(pid)
        except psutil.NoSuchProcess:
            return

        children = []
        try:
            children = proc.children(recursive=True)
        except psutil.NoSuchProcess:
            children = []

        for child in children:
            try:
                child.kill()
            except psutil.NoSuchProcess:
                pass

        try:
            proc.terminate()
            proc.wait(timeout=10)
        except Exception:
            if force:
                try:
                    proc.kill()
                except psutil.NoSuchProcess:
                    pass

