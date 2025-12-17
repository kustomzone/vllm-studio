from __future__ import annotations

import argparse
import uvicorn

from .app import create_app
from .settings_loader import load_settings


def main() -> None:
    parser = argparse.ArgumentParser(description="vLLM Studio Controller")
    parser.add_argument("--config", default=None, help="Path to JSON config file")
    args = parser.parse_args()

    settings = load_settings(args.config)
    app = create_app(settings)
    uvicorn.run(app, host=settings.api_host, port=settings.api_port, log_level="info")


if __name__ == "__main__":
    main()
