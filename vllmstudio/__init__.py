"""vLLM Studio - Model Management for vLLM and SGLang."""

from __future__ import annotations

import os
import subprocess
from importlib.metadata import PackageNotFoundError, version as pkg_version


def _read_version() -> str:
    env_version = os.getenv("VLLMSTUDIO_VERSION")
    if env_version:
        return env_version.strip()

    # Prefer git tags when running from a checkout so UI/API reflects semantic-release tags.
    try:
        root = os.path.dirname(os.path.dirname(__file__))
        described = subprocess.check_output(
            ["git", "-C", root, "describe", "--tags", "--always", "--dirty"],
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
        if described:
            return described
    except Exception:
        pass

    # Fall back to the installed package metadata version.
    try:
        return pkg_version("vllmstudio")
    except PackageNotFoundError:
        return "0.0.0"


__version__ = _read_version()
