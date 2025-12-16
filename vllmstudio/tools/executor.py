"""Tool executor for running tools safely."""
import asyncio
import json
import sys
import traceback
from io import StringIO
from typing import Any, Dict, Optional
from pathlib import Path
import tempfile
import uuid

from .registry import Tool, ToolRegistry, get_registry


class ExecutionResult:
    """Result of tool execution."""
    def __init__(
        self,
        success: bool,
        result: Any = None,
        error: Optional[str] = None,
        stdout: str = "",
        artifacts: Optional[list] = None,
    ):
        self.success = success
        self.result = result
        self.error = error
        self.stdout = stdout
        self.artifacts = artifacts or []
    
    def to_dict(self) -> Dict:
        return {
            "success": self.success,
            "result": self.result,
            "error": self.error,
            "stdout": self.stdout,
            "artifacts": self.artifacts,
        }


class ToolExecutor:
    """Executor for running tools."""
    
    def __init__(self, artifacts_dir: Optional[Path] = None):
        self.artifacts_dir = artifacts_dir or Path(tempfile.gettempdir()) / "vllm_artifacts"
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)
        self.registry = get_registry()
    
    async def execute(self, tool_name: str, arguments: Dict[str, Any]) -> ExecutionResult:
        """Execute a tool with given arguments."""
        tool = self.registry.get(tool_name)
        
        if not tool:
            return ExecutionResult(
                success=False,
                error=f"Tool '{tool_name}' not found"
            )
        
        if not tool.enabled:
            return ExecutionResult(
                success=False,
                error=f"Tool '{tool_name}' is disabled"
            )
        
        if not tool.handler:
            return ExecutionResult(
                success=False,
                error=f"Tool '{tool_name}' has no handler"
            )
        
        try:
            # Capture stdout
            old_stdout = sys.stdout
            sys.stdout = captured = StringIO()
            
            try:
                # Execute handler
                if asyncio.iscoroutinefunction(tool.handler):
                    result = await tool.handler(arguments, self.artifacts_dir)
                else:
                    result = tool.handler(arguments, self.artifacts_dir)
            finally:
                sys.stdout = old_stdout
                stdout = captured.getvalue()
            
            # Handle result
            if isinstance(result, ExecutionResult):
                result.stdout = stdout + result.stdout
                return result
            
            return ExecutionResult(
                success=True,
                result=result,
                stdout=stdout,
            )
            
        except Exception as e:
            return ExecutionResult(
                success=False,
                error=f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}",
            )
    
    async def execute_python(self, code: str) -> ExecutionResult:
        """Execute Python code in a sandboxed environment."""
        # Create execution context with useful imports
        exec_globals = {
            "__builtins__": __builtins__,
            "artifacts_dir": self.artifacts_dir,
        }
        
        # Add safe imports
        safe_modules = [
            "json", "math", "datetime", "random", "re", "collections",
            "itertools", "functools", "operator", "string", "textwrap",
            "csv", "io", "base64", "hashlib", "uuid",
        ]
        
        for module in safe_modules:
            try:
                exec_globals[module] = __import__(module)
            except ImportError:
                pass
        
        # Add artifact generators
        try:
            from ..artifacts import generators
            exec_globals["create_spreadsheet"] = generators.create_spreadsheet
            exec_globals["create_pdf"] = generators.create_pdf
            exec_globals["create_presentation"] = generators.create_presentation
            exec_globals["create_file"] = generators.create_file
        except ImportError:
            pass
        
        artifacts = []
        
        try:
            old_stdout = sys.stdout
            sys.stdout = captured = StringIO()
            
            try:
                exec(code, exec_globals)
            finally:
                sys.stdout = old_stdout
                stdout = captured.getvalue()
            
            # Check for created artifacts
            if "artifacts" in exec_globals:
                artifacts = exec_globals["artifacts"]
            
            result = exec_globals.get("result", None)
            
            return ExecutionResult(
                success=True,
                result=result,
                stdout=stdout,
                artifacts=artifacts,
            )
            
        except Exception as e:
            return ExecutionResult(
                success=False,
                error=f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}",
            )
