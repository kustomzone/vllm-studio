"""CLI entry point for vLLM Studio."""

import argparse
import uvicorn

from .config import settings


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(description="vLLM Studio - Model Management")

    parser.add_argument(
        "--host",
        default=settings.api_host,
        help=f"API host (default: {settings.api_host})"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=settings.api_port,
        help=f"API port (default: {settings.api_port})"
    )
    parser.add_argument(
        "--vllm-port",
        type=int,
        default=settings.vllm_port,
        help=f"vLLM backend port (default: {settings.vllm_port})"
    )
    parser.add_argument(
        "--proxy-port",
        type=int,
        default=settings.proxy_port,
        help=f"Proxy port (default: {settings.proxy_port})"
    )
    parser.add_argument(
        "--models-dir",
        default=str(settings.models_dir),
        help=f"Models directory (default: {settings.models_dir})"
    )
    parser.add_argument(
        "--recipes-dir",
        default=str(settings.recipes_dir),
        help=f"Recipes directory (default: {settings.recipes_dir})"
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Enable auto-reload for development"
    )

    args = parser.parse_args()

    # Update settings
    settings.api_host = args.host
    settings.api_port = args.port
    settings.vllm_port = args.vllm_port
    settings.proxy_port = args.proxy_port

    print(f"""
╔═══════════════════════════════════════════════════════════╗
║                     vLLM Studio                            ║
╠═══════════════════════════════════════════════════════════╣
║  API Server:      http://{args.host}:{args.port}                    ║
║  vLLM Backend:    http://localhost:{args.vllm_port}                 ║
║  Proxy:           http://localhost:{args.proxy_port}                 ║
║  Models Dir:      {args.models_dir:<35} ║
║  Recipes Dir:     {args.recipes_dir:<35} ║
╚═══════════════════════════════════════════════════════════╝
    """)

    uvicorn.run(
        "vllmstudio.api:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info"
    )


if __name__ == "__main__":
    main()
