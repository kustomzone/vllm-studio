from .recipes import router as recipes_router
from .runs import router as runs_router
from .system import router as system_router
from .passthrough import router as passthrough_router
from .openai import router as openai_router
from .auth_keys import router as auth_keys_router
from .v1_models import router as v1_models_router
from .v1_recipes import router as v1_recipes_router
from .ops import router as ops_router

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
]
