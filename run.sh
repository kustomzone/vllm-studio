#!/bin/bash
# Run vLLM Studio

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check for venv
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Run the server
python -m vllmstudio.cli "$@"
