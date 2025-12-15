#!/bin/bash
# Install systemd services for vLLM Studio stack
# Run with: sudo ./install-services.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing systemd services..."

# Copy service files
sudo cp "$SCRIPT_DIR/systemd/vllm-studio.service" /etc/systemd/system/
sudo cp "$SCRIPT_DIR/systemd/vllm-proxy.service" /etc/systemd/system/
sudo cp "$SCRIPT_DIR/systemd/openwebui.service" /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable services (start on boot)
sudo systemctl enable vllm-studio
sudo systemctl enable vllm-proxy
sudo systemctl enable openwebui

echo "Services installed and enabled!"
echo ""
echo "To start all services:"
echo "  sudo systemctl start vllm-studio vllm-proxy openwebui"
echo ""
echo "To check status:"
echo "  sudo systemctl status vllm-studio vllm-proxy openwebui"
echo ""
echo "To view logs:"
echo "  journalctl -u vllm-studio -f"
