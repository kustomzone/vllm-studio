#!/usr/bin/env bash
# CRITICAL
#
# Usage (must be sourced so env vars persist):
#   source scripts/demo-env.sh
#
# This sets up a hermetic, local-only demo environment:
# - Creates shim CLIs for STT/TTS/Image integrations
# - Creates placeholder model files
# - Points controller data/models dirs at `.demo/`
# - Enables mock inference so jobs can run without a real LLM backend
set -euo pipefail

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "This script must be sourced: source scripts/demo-env.sh" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO_DIR="${ROOT}/.demo"
BIN_DIR="${DEMO_DIR}/bin"
MODELS_DIR="${DEMO_DIR}/models"
DATA_DIR="${DEMO_DIR}/data"

mkdir -p "${BIN_DIR}" "${MODELS_DIR}/stt" "${MODELS_DIR}/tts" "${MODELS_DIR}/image" "${DATA_DIR}"

# Placeholder model artifacts (local-only).
touch "${MODELS_DIR}/stt/demo.bin"
touch "${MODELS_DIR}/tts/demo.onnx"
touch "${MODELS_DIR}/image/demo.gguf"

# whisper-cli shim: writes a transcript to <prefix>.txt when invoked with -of <prefix>.
cat > "${BIN_DIR}/whisper-cli" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == "--version" ]]; then
  echo "whisper-cli demo-shim"
  exit 0
fi
prefix=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "-of" ]]; then prefix="$2"; shift 2; continue; fi
  shift
done
if [[ -z "${prefix}" ]]; then
  echo "missing -of prefix" >&2
  exit 2
fi
echo "hello from stt shim" > "${prefix}.txt"
exit 0
SH
chmod +x "${BIN_DIR}/whisper-cli"

# piper shim: writes a tiny placeholder WAV-like file to --output_file.
cat > "${BIN_DIR}/piper" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == "--version" ]]; then
  echo "piper demo-shim"
  exit 0
fi
out=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--output_file" ]]; then out="$2"; shift 2; continue; fi
  shift
done
if [[ -z "${out}" ]]; then
  echo "missing --output_file" >&2
  exit 2
fi
mkdir -p "$(dirname "$out")"
cat >/dev/null # consume stdin
printf 'RIFF' > "$out"
exit 0
SH
chmod +x "${BIN_DIR}/piper"

# sd shim: writes a tiny PNG signature to -o <path>.
cat > "${BIN_DIR}/sd" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == "--version" ]]; then
  echo "sd demo-shim"
  exit 0
fi
out=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "-o" ]]; then out="$2"; shift 2; continue; fi
  shift
done
if [[ -z "${out}" ]]; then
  echo "missing -o output path" >&2
  exit 2
fi
mkdir -p "$(dirname "$out")"
printf '\x89PNG\r\n\x1a\n' > "$out"
exit 0
SH
chmod +x "${BIN_DIR}/sd"

export PATH="${BIN_DIR}:${PATH}"

# Hermetic controller dirs.
export VLLM_STUDIO_DATA_DIR="${DATA_DIR}"
export VLLM_STUDIO_DB_PATH="${DATA_DIR}/controller.db"
export VLLM_STUDIO_MODELS_DIR="${MODELS_DIR}"

# Use mock inference so jobs can run without a real vLLM/sglang backend.
export VLLM_STUDIO_MOCK_INFERENCE="${VLLM_STUDIO_MOCK_INFERENCE:-1}"

# Integration wiring.
export VLLM_STUDIO_STT_CLI="${BIN_DIR}/whisper-cli"
export VLLM_STUDIO_STT_MODEL="demo.bin"
export VLLM_STUDIO_STT_BACKEND="${VLLM_STUDIO_STT_BACKEND:-cpu}"

export VLLM_STUDIO_TTS_CLI="${BIN_DIR}/piper"
export VLLM_STUDIO_TTS_MODEL="demo.onnx"
export VLLM_STUDIO_TTS_BACKEND="${VLLM_STUDIO_TTS_BACKEND:-cpu}"

export VLLM_STUDIO_IMAGE_CLI="${BIN_DIR}/sd"
export VLLM_STUDIO_IMAGE_MODEL="demo.gguf"
export VLLM_STUDIO_IMAGE_BACKEND="${VLLM_STUDIO_IMAGE_BACKEND:-cpu}"

cat <<EOF
Demo env ready.

Next:
  1) Start controller (direct):
     ./start.sh --direct

  2) Start frontend (local):
     cd frontend && npm run dev

Then open:
  http://localhost:3000/jobs
  http://localhost:3000/images
EOF

