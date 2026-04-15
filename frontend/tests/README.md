# Playwright (frontend)

## Isolated chat database (recommended)

Chat sessions live in the controller SQLite file (`chats.db` by default under `VLLM_STUDIO_DATA_DIR`). Playwright tests that call `POST /chats` would otherwise mix with your normal threads.

1. Pick a path for the E2E chat DB (gitignored example):

   `frontend/.playwright/chats-e2e.db`

2. Start the controller with that file **before** running Playwright:

   ```bash
   cd controller
   VLLM_STUDIO_CHATS_DB="$(pwd)/../frontend/.playwright/chats-e2e.db" bun src/main.ts
   ```

3. Run tests with the same backend URL (default `http://127.0.0.1:8080`):

   ```bash
   cd frontend
   npm run test:integration
   ```

Tests that create chats should use titles from `tests/constants.ts` (`e2eChatTitle("…")`) so `npm run script:chats:purge-test-sessions` in the controller can clean automation sessions from a shared DB when needed.

## Purge test-like chats from the current DB

From `controller/` (uses your normal env / `VLLM_STUDIO_CHATS_DB` if set):

```bash
# Preview
bun run script:chats:purge-test-sessions

# Delete matched rows (+ agentfs / local tool dirs for those sessions)
bun run script:chats:purge-test-sessions -- --execute
```

Matched titles include: `E2E:` prefix, `Playwright` in the title, legacy `Playwright Chat`, and `(e2e)` / `[e2e]`.
