"""Pydantic models for vLLM Studio."""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class Backend(str, Enum):
    """Supported inference backends."""
    VLLM = "vllm"
    SGLANG = "sglang"


class RecipeStatus(str, Enum):
    """Status of a recipe."""
    STOPPED = "stopped"
    RUNNING = "running"
    STARTING = "starting"
    STOPPING = "stopping"
    ERROR = "error"


class Recipe(BaseModel):
    """Model launch recipe/configuration."""

    id: str = Field(..., description="Unique recipe identifier")
    name: str = Field(..., description="Human-readable name")
    model_path: str = Field(..., description="Path to model")
    backend: Backend = Field(default=Backend.VLLM)

    # vLLM/SGLang settings
    tensor_parallel_size: int = Field(default=1, alias="tp")
    pipeline_parallel_size: int = Field(default=1, alias="pp")
    data_parallel_size: int = Field(default=1, alias="dp")

    # Memory settings
    max_model_len: int = Field(default=32768)
    gpu_memory_utilization: float = Field(default=0.85)
    kv_cache_dtype: str = Field(default="auto")
    swap_space: int = Field(default=16)

    # Batching settings
    max_num_seqs: int = Field(default=12)
    max_num_batched_tokens: int = Field(default=8192)
    block_size: int = Field(default=32)

    # Feature flags
    enable_expert_parallel: bool = Field(default=False)
    disable_custom_all_reduce: bool = Field(default=True)
    disable_log_requests: bool = Field(default=True)
    trust_remote_code: bool = Field(default=True)

    # Tool calling
    enable_auto_tool_choice: bool = Field(default=True)
    tool_call_parser: Optional[str] = Field(default=None)
    reasoning_parser: Optional[str] = Field(default=None)

    # Quantization
    quantization: Optional[str] = Field(default=None)
    dtype: Optional[str] = Field(default=None)
    calculate_kv_scales: bool = Field(default=False)

    # Environment
    cuda_visible_devices: Optional[str] = Field(default=None)
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000)

    # Extra arguments
    extra_args: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        populate_by_name = True


class RecipeWithStatus(Recipe):
    """Recipe with current runtime status."""
    status: RecipeStatus = RecipeStatus.STOPPED
    pid: Optional[int] = None
    error_message: Optional[str] = None


class ModelInfo(BaseModel):
    """Information about an indexed model."""
    path: str
    name: str
    size_gb: Optional[float] = None
    has_config: bool = False
    model_type: Optional[str] = None


class ProcessInfo(BaseModel):
    """Information about a running inference process."""
    pid: int
    backend: Backend
    model_path: str
    port: int
    cmdline: List[str]
    memory_gb: float
    gpu_memory_gb: Optional[float] = None


class SwitchRequest(BaseModel):
    """Request to switch to a different model/recipe."""
    recipe_id: str
    force: bool = Field(default=False, description="Force kill current process")


class SwitchResponse(BaseModel):
    """Response after switching models."""
    success: bool
    message: str
    old_recipe: Optional[str] = None
    new_recipe: str
    pid: Optional[int] = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    version: str
    running_model: Optional[str] = None
    backend_reachable: bool = False
    proxy_reachable: bool = False
