#!/bin/bash
# vLLM Studio - Unified Launcher (controller)
# Usage: ./start.sh [--dev] [--port PORT] [--ngrok]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Defaults
API_PORT="${VLLMSTUDIO_CONTROLLER_API_PORT:-${VLLMSTUDIO_API_PORT:-8080}}"
VLLM_PORT="${VLLMSTUDIO_CONTROLLER_INFERENCE_PORT:-${VLLMSTUDIO_VLLM_PORT:-8000}}"
PROXY_PORT="${VLLMSTUDIO_CONTROLLER_PROXY_PORT:-${VLLMSTUDIO_PROXY_PORT:-8001}}"
LOG_FILE="/tmp/vllmstudio.log"
PID_FILE="/tmp/vllmstudio.pid"
DEV_MODE=false
START_NGROK=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dev)
            DEV_MODE=true
            shift
            ;;
        --port)
            API_PORT="$2"
            shift 2
            ;;
        --ngrok)
            START_NGROK=true
            shift
            ;;
        --help|-h)
            echo "vLLM Studio - Model Management API"
            echo ""
            echo "Usage: ./start.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dev       Run in development mode (foreground with reload)"
            echo "  --port N    Set API port (default: 8080)"
            echo "  --ngrok     Start ngrok tunnel"
            echo "  -h, --help  Show this help"
            echo ""
            echo "Environment Variables:"
            echo "  VLLMSTUDIO_CONTROLLER_API_PORT       Controller API port (default: 8080)"
            echo "  VLLMSTUDIO_CONTROLLER_INFERENCE_PORT  Inference backend port (default: 8000)"
            echo "  VLLMSTUDIO_CONTROLLER_PROXY_PORT      Proxy port (default: 8001)"
            echo "  VLLMSTUDIO_MODELS_DIR   Model storage directory"
            echo "  VLLMSTUDIO_RECIPES_DIR  Recipe JSON directory"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Banner
echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                     vLLM Studio                            ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check Python environment
if [ -d ".venv" ]; then
    source .venv/bin/activate
    echo -e "${GREEN}✓${NC} Virtual environment activated"
else
    echo -e "${YELLOW}!${NC} No .venv found, using system Python"
fi

# Check if already running
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo -e "${YELLOW}!${NC} vLLM Studio already running (PID: $OLD_PID)"
        read -p "Kill existing process? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kill "$OLD_PID" 2>/dev/null || true
            sleep 1
            echo -e "${GREEN}✓${NC} Killed existing process"
        else
            echo "Exiting."
            exit 0
        fi
    fi
fi

# Kill any process on the port
if lsof -i ":$API_PORT" -t >/dev/null 2>&1; then
    echo -e "${YELLOW}!${NC} Port $API_PORT in use, killing..."
    lsof -i ":$API_PORT" -t | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Start server
if [ "$DEV_MODE" = true ]; then
    echo -e "${BLUE}Starting in development mode...${NC}"
    echo ""
    export VLLMSTUDIO_CONTROLLER_API_PORT="$API_PORT"
    export VLLMSTUDIO_CONTROLLER_INFERENCE_PORT="$VLLM_PORT"
    export VLLMSTUDIO_CONTROLLER_PROXY_PORT="$PROXY_PORT"
    exec python -m vllmstudio_controller.cli --reload
else
    echo -e "${BLUE}Starting in background...${NC}"
    export VLLMSTUDIO_CONTROLLER_API_PORT="$API_PORT"
    export VLLMSTUDIO_CONTROLLER_INFERENCE_PORT="$VLLM_PORT"
    export VLLMSTUDIO_CONTROLLER_PROXY_PORT="$PROXY_PORT"
    nohup python -m vllmstudio_controller.cli > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    sleep 2

    # Verify started
    if curl -s "http://localhost:$API_PORT/health" >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} API Server running on http://localhost:$API_PORT"
    else
        echo -e "${RED}✗${NC} Failed to start. Check $LOG_FILE"
        tail -20 "$LOG_FILE"
        exit 1
    fi
fi

# Start ngrok if requested
if [ "$START_NGROK" = true ]; then
    echo -e "${BLUE}Starting ngrok tunnel...${NC}"
    pkill -f "ngrok http $API_PORT" 2>/dev/null || true
    nohup ngrok http "$API_PORT" --log=stdout > /tmp/ngrok.log 2>&1 &
    sleep 3
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['tunnels'][0]['public_url'])" 2>/dev/null || echo "")
    if [ -n "$NGROK_URL" ]; then
        echo -e "${GREEN}✓${NC} ngrok tunnel: $NGROK_URL"
    else
        echo -e "${YELLOW}!${NC} ngrok started but couldn't get URL. Check /tmp/ngrok.log"
    fi
fi

# Summary
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}Dashboard:${NC}   http://localhost:$API_PORT"
echo -e "  ${GREEN}API Docs:${NC}    http://localhost:$API_PORT/docs"
echo -e "  ${GREEN}Logs:${NC}        tail -f $LOG_FILE"
echo -e "  ${GREEN}Stop:${NC}        kill \$(cat $PID_FILE)"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
