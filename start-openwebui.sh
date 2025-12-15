#!/bin/bash
# Start vLLM Studio + OpenWebUI integrated system
#
# This script starts:
# 1. vLLM Studio API on port 8080 (manages vLLM/SGLang models)
# 2. OpenWebUI on port 3000 (chat interface with vLLM Studio integration)
#
# Usage:
#   ./start-openwebui.sh          # Start both services
#   ./start-openwebui.sh --dev    # Development mode (hot reload)
#   ./start-openwebui.sh --stop   # Stop all services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VLLM_STUDIO_PORT=8080
PROXY_PORT=8001
OPENWEBUI_PORT=3000
VLLM_STUDIO_LOG="$SCRIPT_DIR/logs/vllm-studio.log"
PROXY_LOG="$SCRIPT_DIR/logs/proxy.log"
OPENWEBUI_LOG="$SCRIPT_DIR/logs/openwebui.log"

mkdir -p "$SCRIPT_DIR/logs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[OK]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

stop_services() {
    print_status "Stopping services..."

    # Kill vLLM Studio
    if lsof -i :$VLLM_STUDIO_PORT -t >/dev/null 2>&1; then
        lsof -i :$VLLM_STUDIO_PORT -t | xargs kill -9 2>/dev/null || true
        print_success "Stopped vLLM Studio"
    fi

    # Kill proxy
    if lsof -i :$PROXY_PORT -t >/dev/null 2>&1; then
        lsof -i :$PROXY_PORT -t | xargs kill -9 2>/dev/null || true
        print_success "Stopped Proxy"
    fi

    # Kill OpenWebUI
    if lsof -i :$OPENWEBUI_PORT -t >/dev/null 2>&1; then
        lsof -i :$OPENWEBUI_PORT -t | xargs kill -9 2>/dev/null || true
        print_success "Stopped OpenWebUI"
    fi

    print_success "All services stopped"
}

start_vllm_studio() {
    print_status "Starting vLLM Studio API on port $VLLM_STUDIO_PORT..."

    if lsof -i :$VLLM_STUDIO_PORT -t >/dev/null 2>&1; then
        print_warning "Port $VLLM_STUDIO_PORT already in use, killing existing process"
        lsof -i :$VLLM_STUDIO_PORT -t | xargs kill -9 2>/dev/null || true
        sleep 2
    fi

    cd "$SCRIPT_DIR"
    source .venv/bin/activate
    export VLLMSTUDIO_PROXY_PORT="$PROXY_PORT"
    nohup python -m vllmstudio.cli > "$VLLM_STUDIO_LOG" 2>&1 &

    # Wait for API to be ready
    for i in {1..30}; do
        if curl -s http://localhost:$VLLM_STUDIO_PORT/health >/dev/null 2>&1; then
            print_success "vLLM Studio API ready at http://localhost:$VLLM_STUDIO_PORT"
            return 0
        fi
        sleep 1
    done

    print_error "vLLM Studio failed to start. Check $VLLM_STUDIO_LOG"
    return 1
}

start_openwebui() {
    local dev_mode=$1

    print_status "Starting OpenWebUI on port $OPENWEBUI_PORT..."

    if lsof -i :$OPENWEBUI_PORT -t >/dev/null 2>&1; then
        print_warning "Port $OPENWEBUI_PORT already in use, killing existing process"
        lsof -i :$OPENWEBUI_PORT -t | xargs kill -9 2>/dev/null || true
        sleep 2
    fi

    cd "$SCRIPT_DIR/openwebui-src/backend"

    # Set environment variables
    export VLLM_STUDIO_URL="http://localhost:$VLLM_STUDIO_PORT"
    export FRONTEND_BUILD_DIR="$SCRIPT_DIR/openwebui-src/build"
    export PORT=$OPENWEBUI_PORT
    export WEBUI_AUTH=false  # Disable auth for local development
    export OPENAI_API_BASE_URL="http://localhost:$VLLM_STUDIO_PORT/v1"
    export OPENAI_API_KEY="dummy"

    # Activate venv and install dependencies if needed
    if [ ! -d ".venv" ]; then
        print_status "Creating OpenWebUI Python venv..."
        uv venv .venv
    fi

    source .venv/bin/activate

    # Install backend deps if needed
    if ! python -c "import open_webui" 2>/dev/null; then
        print_status "Installing OpenWebUI backend dependencies..."
        uv pip install -e . 2>&1 | tail -5
    fi

    if [ "$dev_mode" = "true" ]; then
        print_status "Starting in development mode..."
        "$SCRIPT_DIR/openwebui-src/backend/.venv/bin/uvicorn" open_webui.main:app --host 0.0.0.0 --port $OPENWEBUI_PORT --reload &
    else
        nohup "$SCRIPT_DIR/openwebui-src/backend/.venv/bin/uvicorn" open_webui.main:app --host 0.0.0.0 --port $OPENWEBUI_PORT > "$OPENWEBUI_LOG" 2>&1 &
    fi

    # Wait for OpenWebUI to be ready
    for i in {1..60}; do
        if curl -s http://localhost:$OPENWEBUI_PORT/health >/dev/null 2>&1; then
            print_success "OpenWebUI ready at http://localhost:$OPENWEBUI_PORT"
            return 0
        fi
        sleep 1
    done

    print_error "OpenWebUI failed to start. Check $OPENWEBUI_LOG"
    return 1
}

start_proxy() {
    print_status "Starting Proxy on port $PROXY_PORT..."

    if lsof -i :$PROXY_PORT -t >/dev/null 2>&1; then
        print_warning "Port $PROXY_PORT already in use, killing existing process"
        lsof -i :$PROXY_PORT -t | xargs kill -9 2>/dev/null || true
        sleep 1
    fi

    cd "$SCRIPT_DIR"
    if [ -d ".venv" ]; then
        source .venv/bin/activate
    fi

    nohup uvicorn proxy.main:app --host 0.0.0.0 --port $PROXY_PORT > "$PROXY_LOG" 2>&1 &

    for i in {1..20}; do
        if curl -s http://localhost:$PROXY_PORT/health >/dev/null 2>&1; then
            print_success "Proxy ready at http://localhost:$PROXY_PORT"
            return 0
        fi
        sleep 1
    done

    print_error "Proxy failed to start. Check $PROXY_LOG"
    return 1
}

show_status() {
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}       vLLM Studio + OpenWebUI              ${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""

    if curl -s http://localhost:$VLLM_STUDIO_PORT/health >/dev/null 2>&1; then
        echo -e "  vLLM Studio API:  ${GREEN}Running${NC} at http://localhost:$VLLM_STUDIO_PORT"
    else
        echo -e "  vLLM Studio API:  ${RED}Stopped${NC}"
    fi

    if curl -s http://localhost:$OPENWEBUI_PORT/health >/dev/null 2>&1; then
        echo -e "  OpenWebUI:        ${GREEN}Running${NC} at http://localhost:$OPENWEBUI_PORT"
    else
        echo -e "  OpenWebUI:        ${RED}Stopped${NC}"
    fi

    if curl -s http://localhost:$PROXY_PORT/health >/dev/null 2>&1; then
        echo -e "  Proxy:            ${GREEN}Running${NC} at http://localhost:$PROXY_PORT"
    else
        echo -e "  Proxy:            ${RED}Stopped${NC}"
    fi

    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo ""
    echo "  vLLM Studio page: http://localhost:$OPENWEBUI_PORT/vllm-studio"
    echo "  Chat interface:   http://localhost:$OPENWEBUI_PORT"
    echo ""
}

# Main
case "${1:-}" in
    --stop)
        stop_services
        ;;
    --status)
        show_status
        ;;
    --dev)
        start_vllm_studio
        start_proxy
        start_openwebui true
        show_status
        ;;
    *)
        start_vllm_studio
        start_proxy
        start_openwebui false
        show_status
        ;;
esac
