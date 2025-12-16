"""Built-in tools for vLLM Studio."""
from pathlib import Path
from typing import Any, Dict

from .registry import Tool, ToolParameter, ToolType, get_registry
from .executor import ExecutionResult


def python_execute_handler(args: Dict[str, Any], artifacts_dir: Path) -> ExecutionResult:
    """Execute Python code."""
    code = args.get("code", "")
    
    # Create execution context
    exec_globals = {
        "__builtins__": __builtins__,
        "artifacts_dir": artifacts_dir,
        "artifacts": [],
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
        exec_globals["create_spreadsheet"] = lambda *a, **kw: generators.create_spreadsheet(*a, artifacts_dir=artifacts_dir, **kw)
        exec_globals["create_pdf"] = lambda *a, **kw: generators.create_pdf(*a, artifacts_dir=artifacts_dir, **kw)
        exec_globals["create_presentation"] = lambda *a, **kw: generators.create_presentation(*a, artifacts_dir=artifacts_dir, **kw)
        exec_globals["create_file"] = lambda *a, **kw: generators.create_file(*a, artifacts_dir=artifacts_dir, **kw)
    except ImportError as e:
        pass
    
    import sys
    from io import StringIO
    
    old_stdout = sys.stdout
    sys.stdout = captured = StringIO()
    
    try:
        exec(code, exec_globals)
        stdout = captured.getvalue()
        
        return ExecutionResult(
            success=True,
            result=exec_globals.get("result"),
            stdout=stdout,
            artifacts=exec_globals.get("artifacts", []),
        )
    except Exception as e:
        import traceback
        return ExecutionResult(
            success=False,
            error=f"{type(e).__name__}: {str(e)}",
            stdout=captured.getvalue(),
        )
    finally:
        sys.stdout = old_stdout


def create_spreadsheet_handler(args: Dict[str, Any], artifacts_dir: Path) -> ExecutionResult:
    """Create a spreadsheet from data."""
    from ..artifacts import generators
    
    data = args.get("data", [])
    headers = args.get("headers")
    filename = args.get("filename", "data.xlsx")
    sheet_name = args.get("sheet_name", "Sheet1")
    
    result = generators.create_spreadsheet(
        data=data,
        filename=filename,
        artifacts_dir=artifacts_dir,
        sheet_name=sheet_name,
        headers=headers,
    )
    
    if "error" in result:
        return ExecutionResult(success=False, error=result["error"])
    
    return ExecutionResult(success=True, result=result, artifacts=[result])


def create_document_handler(args: Dict[str, Any], artifacts_dir: Path) -> ExecutionResult:
    """Create a PDF document."""
    from ..artifacts import generators
    
    content = args.get("content", "")
    title = args.get("title")
    filename = args.get("filename", "document.pdf")
    
    result = generators.create_pdf(
        content=content,
        filename=filename,
        artifacts_dir=artifacts_dir,
        title=title,
    )
    
    if "error" in result:
        return ExecutionResult(success=False, error=result["error"])
    
    return ExecutionResult(success=True, result=result, artifacts=[result])


def create_presentation_handler(args: Dict[str, Any], artifacts_dir: Path) -> ExecutionResult:
    """Create a PowerPoint presentation."""
    from ..artifacts import generators
    
    slides = args.get("slides", [])
    filename = args.get("filename", "presentation.pptx")
    
    result = generators.create_presentation(
        slides=slides,
        filename=filename,
        artifacts_dir=artifacts_dir,
    )
    
    if "error" in result:
        return ExecutionResult(success=False, error=result["error"])
    
    return ExecutionResult(success=True, result=result, artifacts=[result])


def register_builtin_tools():
    """Register all built-in tools."""
    registry = get_registry()
    
    # Python code execution
    registry.register(Tool(
        name="python",
        description="Execute Python code. Use this to perform calculations, data processing, or create files. Available functions: create_spreadsheet(data, filename, headers), create_pdf(content, filename, title), create_presentation(slides, filename), create_file(content, filename). Store results in 'result' variable and artifacts in 'artifacts' list.",
        parameters=[
            ToolParameter(
                name="code",
                type="string",
                description="Python code to execute",
                required=True,
            ),
        ],
        tool_type=ToolType.BUILTIN,
        handler=python_execute_handler,
    ))
    
    # Spreadsheet creation
    registry.register(Tool(
        name="create_spreadsheet",
        description="Create an Excel spreadsheet with data",
        parameters=[
            ToolParameter(
                name="data",
                type="array",
                description="2D array of data rows",
                required=True,
            ),
            ToolParameter(
                name="headers",
                type="array",
                description="Optional column headers",
                required=False,
            ),
            ToolParameter(
                name="filename",
                type="string",
                description="Output filename (default: data.xlsx)",
                required=False,
            ),
            ToolParameter(
                name="sheet_name",
                type="string",
                description="Sheet name (default: Sheet1)",
                required=False,
            ),
        ],
        tool_type=ToolType.BUILTIN,
        handler=create_spreadsheet_handler,
    ))
    
    # PDF creation
    registry.register(Tool(
        name="create_document",
        description="Create a PDF document with text content",
        parameters=[
            ToolParameter(
                name="content",
                type="string",
                description="Document text content (paragraphs separated by double newlines)",
                required=True,
            ),
            ToolParameter(
                name="title",
                type="string",
                description="Optional document title",
                required=False,
            ),
            ToolParameter(
                name="filename",
                type="string",
                description="Output filename (default: document.pdf)",
                required=False,
            ),
        ],
        tool_type=ToolType.BUILTIN,
        handler=create_document_handler,
    ))
    
    # Presentation creation
    registry.register(Tool(
        name="create_presentation",
        description="Create a PowerPoint presentation",
        parameters=[
            ToolParameter(
                name="slides",
                type="array",
                description="Array of slide objects with {title, bullets/content, layout}",
                required=True,
            ),
            ToolParameter(
                name="filename",
                type="string",
                description="Output filename (default: presentation.pptx)",
                required=False,
            ),
        ],
        tool_type=ToolType.BUILTIN,
        handler=create_presentation_handler,
    ))
