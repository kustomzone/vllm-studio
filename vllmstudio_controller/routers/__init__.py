from .recipes import router as recipes_router
from .runs import router as runs_router
from .system import router as system_router
from .passthrough import router as passthrough_router
from .openai import router as openai_router
from .auth_keys import router as auth_keys_router
from .v1_models import router as v1_models_router
from .v1_recipes import router as v1_recipes_router
from .ops import router as ops_router
from .compat_gpus_metrics import router as compat_gpus_metrics_router
from .compat_models_browser import router as compat_models_browser_router
from .compat_vram import router as compat_vram_router
from .compat_logs import router as compat_logs_router
from .compat_recipes_io import router as compat_recipes_io_router
from .compat_tokens_usage import router as compat_tokens_usage_router
from .compat_chats import router as compat_chats_router
from .compat_mcp import router as compat_mcp_router
from .compat_skills import router as compat_skills_router

__all__ = [
    "recipes_router",
    "runs_router",
    "system_router",
    "passthrough_router",
    "openai_router",
    "auth_keys_router",
    "v1_models_router",
    "v1_recipes_router",
    "ops_router",
    "compat_gpus_metrics_router",
    "compat_models_browser_router",
    "compat_vram_router",
    "compat_logs_router",
    "compat_recipes_io_router",
    "compat_tokens_usage_router",
    "compat_chats_router",
    "compat_mcp_router",
    "compat_skills_router",
]
