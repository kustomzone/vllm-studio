#!/bin/bash
# Setup vLLM Studio

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Setting up vLLM Studio..."

# Create venv with uv
if command -v uv &> /dev/null; then
    echo "Using uv to create venv..."
    uv venv .venv
    source .venv/bin/activate
    uv pip install -e .
else
    echo "Using python venv..."
    python -m venv .venv
    source .venv/bin/activate
    pip install -e .
fi

# Create recipes directory
mkdir -p recipes

echo "Setup complete!"
echo ""
echo "To run vLLM Studio:"
echo "  ./run.sh"
echo ""
echo "Or with Python:"
echo "  source .venv/bin/activate"
echo "  python -m vllmstudio.cli"
