# Cloudflare Tunnel

If you see **Error 1033 (Cloudflare Tunnel error)**, Cloudflare cannot reach your `cloudflared` tunnel process.

## Required routing

- `app.<your-domain>` → `http://127.0.0.1:3000` (frontend)
- `<your-domain>` → `http://127.0.0.1:8080` (controller/backend API)

Template: `config/cloudflared/config.docker.example.yml`

## Run via Docker (recommended)

1. Create the tunnel and download credentials into `~/.cloudflared/` using Cloudflare Zero Trust.
2. Write `~/.cloudflared/config.docker.yml` based on the template.
3. Start the stack with `docker compose -f docker-compose.stack.yml up -d cloudflared`.

## Debug checklist

- `docker ps | rg cloudflared`
- `cloudflared` logs: `docker logs -n 200 cloudflared-vllm-studio`
- Ensure the `ingress:` services point at the correct ports and `cloudflared` is on the same network namespace (host network in `docker-compose.stack.yml`).
