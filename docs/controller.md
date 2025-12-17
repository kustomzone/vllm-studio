# Controller (Canary)

This repo contains the existing full-featured controller (`vllmstudio/`) and a new minimal controller canary (`vllmstudio_controller/`).

## Goals

- SQLite-backed recipe storage
- Small, modular files (routers/services/stores)
- Swagger/OpenAPI docs
- Safe to develop without breaking the current production stack

## Run

```bash
export VLLMSTUDIO_CONTROLLER_API_PORT=8080
export VLLMSTUDIO_CONTROLLER_ADMIN_KEY="sk-admin-..."
export VLLMSTUDIO_CONTROLLER_SQLITE_PATH="./data/controller.db"
export VLLMSTUDIO_CONTROLLER_INFERENCE_HOST="localhost"
export VLLMSTUDIO_CONTROLLER_INFERENCE_PORT=8000
export VLLMSTUDIO_CONTROLLER_PROXY_PORT=8001

python -m vllmstudio_controller.cli
```

Open Swagger:

- `http://localhost:8080/docs`
- `http://localhost:8080/openapi.json`

## Canary with the existing frontend

Point the frontend to the canary controller:

```bash
cd frontend
export NEXT_PUBLIC_API_URL="http://localhost:8080"
export API_KEY="sk-..."
npm run dev -- --port 3000
```

## JSON config (recommended)

Start from `config/controller.example.json`:

```json
{
  "api_host": "0.0.0.0",
  "api_port": 8080,
  "admin_key": "sk-admin-...",
  "sqlite_path": "./data/controller.db",
  "inference_host": "localhost",
  "inference_port": 8000,
  "proxy_host": "localhost",
  "proxy_port": 8001,
  "enable_openai_passthrough": true,
  "enable_anthropic_passthrough": true
}
```

Run:

```bash
vllmstudio-controller --config config/controller.json
```

## API keys (recommended)

- Admin manages user keys with `POST /auth/keys` (requires `Authorization: Bearer <admin_key>`).
- Keys are stored hashed in SQLite and support scopes.
- Default scopes for a new key: `inference:read`, `inference:write`, `recipes:read`.

Core endpoints:

- `GET /v1/models` (model aliases + default recipe id)
- `GET/POST/PUT /v1/recipes` (recipes + `model_key` + `is_default`)
- `POST /switch` (launch/switch active recipe)
