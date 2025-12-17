"""Process management for vLLM and SGLang."""

import os
import signal
import asyncio
import subprocess
from typing import Optional, List, Tuple
from pathlib import Path

import psutil

from .models import Backend, ProcessInfo, Recipe
from .backends import get_backend
from .config import settings


class ProcessManager:
    """Manages vLLM and SGLang processes."""

    @staticmethod
    def find_inference_processes() -> List[ProcessInfo]:
        """Find all running vLLM and SGLang processes."""
        processes = []

        for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'memory_info']):
            try:
                cmdline = proc.info['cmdline']
                if not cmdline:
                    continue

                cmdline_str = ' '.join(cmdline)

                # Check for vLLM
                if 'vllm serve' in cmdline_str or 'vllm.entrypoints' in cmdline_str:
                    model_path = ProcessManager._extract_model_path(cmdline, 'vllm')
                    port = ProcessManager._extract_port(cmdline)
                    served_name = ProcessManager._extract_served_model_name(cmdline)
                    if model_path:
                        processes.append(ProcessInfo(
                            pid=proc.info['pid'],
                            backend=Backend.VLLM,
                            model_path=model_path,
                            port=port,
                            cmdline=cmdline,
                            memory_gb=proc.info['memory_info'].rss / (1024**3),
                            served_model_name=served_name
                        ))

                # Check for SGLang
                elif 'sglang' in cmdline_str and 'serve' in cmdline_str:
                    model_path = ProcessManager._extract_model_path(cmdline, 'sglang')
                    port = ProcessManager._extract_port(cmdline)
                    served_name = ProcessManager._extract_served_model_name(cmdline)
                    if model_path:
                        processes.append(ProcessInfo(
                            pid=proc.info['pid'],
                            backend=Backend.SGLANG,
                            model_path=model_path,
                            port=port,
                            cmdline=cmdline,
                            memory_gb=proc.info['memory_info'].rss / (1024**3),
                            served_model_name=served_name
                        ))

            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue

        return processes

    @staticmethod
    def _extract_model_path(cmdline: List[str], backend: str) -> Optional[str]:
        """Extract model path from command line."""
        in_serve = False
        for i, arg in enumerate(cmdline):
            if 'serve' in arg:
                in_serve = True
                continue
            if in_serve and not arg.startswith('-') and '/' in arg:
                return arg
            # Match --model flag (only full form, not -m which conflicts with python -m)
            if arg == '--model' and i + 1 < len(cmdline):
                return cmdline[i + 1]
            # Match --model-path for sglang
            if arg == '--model-path' and i + 1 < len(cmdline):
                return cmdline[i + 1]
        return None

    @staticmethod
    def _extract_port(cmdline: List[str]) -> int:
        """Extract port from command line."""
        for i, arg in enumerate(cmdline):
            if arg == '--port' and i + 1 < len(cmdline):
                try:
                    return int(cmdline[i + 1])
                except ValueError:
                    pass
        return 8000

    @staticmethod
    def _extract_served_model_name(cmdline: List[str]) -> Optional[str]:
        """Extract served-model-name from command line."""
        for i, arg in enumerate(cmdline):
            if arg == '--served-model-name' and i + 1 < len(cmdline):
                return cmdline[i + 1]
        return None

    @staticmethod
    def get_current_process(port: int = 8000) -> Optional[ProcessInfo]:
        """Get the inference process running on a specific port."""
        processes = ProcessManager.find_inference_processes()
        for proc in processes:
            if proc.port == port:
                return proc
        return None

    @staticmethod
    async def kill_process(pid: int, force: bool = False, timeout: int = 30) -> bool:
        """Kill a process and all its children."""
        try:
            proc = psutil.Process(pid)

            # Get all child processes first (including grandchildren)
            children = []
            try:
                children = proc.children(recursive=True)
            except psutil.NoSuchProcess:
                pass

            # Kill children first
            for child in children:
                try:
                    child.kill()
                except psutil.NoSuchProcess:
                    pass

            # Wait for children to die
            for child in children:
                try:
                    child.wait(timeout=5)
                except (psutil.NoSuchProcess, psutil.TimeoutExpired):
                    pass

            # Now kill the parent
            if not force:
                proc.terminate()
                try:
                    proc.wait(timeout=timeout)
                    return True
                except psutil.TimeoutExpired:
                    pass

            # Force kill
            proc.kill()
            try:
                proc.wait(timeout=5)
            except psutil.TimeoutExpired:
                pass

            return True

        except psutil.NoSuchProcess:
            return True
        except Exception as e:
            print(f"Error killing process {pid}: {e}")
            return False

    @staticmethod
    async def kill_all_inference_processes(port: int = 8000) -> bool:
        """Kill all inference-related processes on a port, including workers."""
        # First kill the main process
        current = ProcessManager.get_current_process(port)
        if current:
            await ProcessManager.kill_process(current.pid, force=True)

        # Also kill any orphaned vLLM workers
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                cmdline = proc.info.get('cmdline', [])
                if cmdline:
                    cmdline_str = ' '.join(cmdline)
                    # Skip vllmstudio processes - only kill vllm inference workers
                    if 'vllmstudio' in cmdline_str:
                        continue
                    if 'VLLM::Worker' in proc.info.get('name', '') or \
                       'vllm serve' in cmdline_str.lower() or \
                       'vllm.entrypoints' in cmdline_str or \
                       'ray::' in cmdline_str:
                        try:
                            proc.kill()
                        except psutil.NoSuchProcess:
                            pass
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue

        await asyncio.sleep(2)
        return True

    @staticmethod
    async def evict_current_model(port: int = 8000, force: bool = False) -> Tuple[bool, Optional[str]]:
        """Evict the currently running model on the given port."""
        current = ProcessManager.get_current_process(port)
        if not current:
            # Still try to clean up any orphaned workers
            await ProcessManager.kill_all_inference_processes(port)
            return True, None

        model_path = current.model_path

        # Use comprehensive cleanup
        success = await ProcessManager.kill_all_inference_processes(port)

        # Extra wait for GPU memory release
        await asyncio.sleep(5)

        return success, model_path

    @staticmethod
    def build_launch_command(recipe: Recipe) -> List[str]:
        """Build the launch command for a recipe."""
        return get_backend(recipe.backend).build_launch_command(recipe)

    @staticmethod
    async def launch_model(recipe: Recipe) -> Tuple[bool, Optional[int], str]:
        """Launch a model with the given recipe."""
        cmd = ProcessManager.build_launch_command(recipe)

        # Set environment
        env = os.environ.copy()
        env.update(get_backend(recipe.backend).build_launch_env(recipe))

        # Create log file for vLLM output
        log_file = get_backend(recipe.backend).default_log_file(recipe.id)

        try:
            # Launch as a detached process with output to log file
            with open(log_file, 'w') as log_fh:
                process = subprocess.Popen(
                    cmd,
                    stdout=log_fh,
                    stderr=subprocess.STDOUT,
                    env=env,
                    start_new_session=True
                )

            # Wait a bit to check if it started successfully
            await asyncio.sleep(5)

            if process.poll() is not None:
                # Process exited - read error from log
                try:
                    error_msg = log_file.read_text()[-500:]
                except:
                    error_msg = "Unknown error"
                return False, None, f"Process exited immediately: {error_msg}"

            return True, process.pid, f"Launched with PID {process.pid}, log: {log_file}"

        except Exception as e:
            return False, None, str(e)

    @staticmethod
    async def wait_for_model_ready(port: int = 8000, timeout: int = 300) -> bool:
        """Wait for model to be ready by checking health endpoint."""
        import httpx

        start_time = asyncio.get_event_loop().time()

        while asyncio.get_event_loop().time() - start_time < timeout:
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        f"http://localhost:{port}/health",
                        timeout=5.0
                    )
                    if response.status_code == 200:
                        return True
            except:
                pass

            await asyncio.sleep(5)

        return False
