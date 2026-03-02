# Desktop App (Electron) — Production Build + Release

This module packages `frontend/` as a signed desktop app with an embedded standalone Next.js server.

## What ships

- Electron main process (`frontend/desktop/main.ts`)
- Hardened preload bridge (`frontend/desktop/preload.ts`)
- Embedded frontend runtime from `frontend/.next/standalone`
- Static assets from `frontend/.next/static` and `frontend/public`
- Auto-update plumbing via `electron-updater`

## Local development

```bash
cd frontend
npm ci
npm run desktop:dev
```

This starts:

1. `next dev` on `http://127.0.0.1:3000`
2. Electron shell loading that local URL

## Production build artifacts

```bash
cd frontend
npm run desktop:dist
```

Pipeline:

1. `npm run build` (standalone Next output)
2. `npm run desktop:build:main` (compile desktop TS)
3. `electron-builder` packages installers to `frontend/dist-desktop/`

## Security posture (baseline)

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- Strict new-window and navigation policy
- No raw Node APIs exposed to renderer; preload IPC allowlist only

## Update channels

Set channel + endpoint at build/runtime:

```bash
export VLLM_STUDIO_DESKTOP_CHANNEL=stable   # stable|beta|alpha
export VLLM_STUDIO_UPDATE_URL=https://updates.example.com/vllm-studio
```

Disable updater for local testing:

```bash
export VLLM_STUDIO_DESKTOP_DISABLE_AUTO_UPDATE=true
```

## macOS signing + notarization

Required env for CI release builds:

```bash
export APPLE_ID=...
export APPLE_APP_SPECIFIC_PASSWORD=...
export APPLE_TEAM_ID=...
export CSC_LINK=...         # signing cert
export CSC_KEY_PASSWORD=...
```

`electron-builder` uses `frontend/desktop/resources/entitlements.mac.plist`.

## Windows signing

Set in CI before `npm run desktop:dist`:

```bash
export CSC_LINK=...
export CSC_KEY_PASSWORD=...
```

## Runtime data path

Desktop runtime sets:

- `VLLM_STUDIO_DATA_DIR=<Electron userData path>`

This ensures settings persist under platform-native app data instead of repo-local files.

## Release gates (minimum)

From `frontend/`:

```bash
npm run lint
npm run test
npm run build
npm run desktop:build:main
npm run desktop:dist
```

Collect these as release evidence:

- `frontend/dist-desktop/*`
- `frontend/test-output/*` (if E2E or UI smoke tests were run)
- Build logs from CI workflow
