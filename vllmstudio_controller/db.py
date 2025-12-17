"""SQLite helper with lightweight schema migrations."""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator


SCHEMA_VERSION = 2


@dataclass(frozen=True)
class SQLiteDB:
    path: Path

    def connect(self) -> sqlite3.Connection:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    def migrate(self) -> None:
        with self.connect() as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)")
            row = conn.execute("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1").fetchone()
            current = int(row["version"]) if row else 0

            if current < 1:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS recipes (
                      id TEXT PRIMARY KEY,
                      json TEXT NOT NULL,
                      created_at TEXT NOT NULL,
                      updated_at TEXT NOT NULL
                    )
                    """
                )
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS usage_events (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      ts REAL NOT NULL,
                      request_id TEXT NOT NULL,
                      model TEXT,
                      endpoint TEXT,
                      prompt_tokens INTEGER,
                      completion_tokens INTEGER,
                      total_tokens INTEGER,
                      latency_ms REAL
                    )
                    """
                )
                conn.execute("CREATE INDEX IF NOT EXISTS idx_usage_events_ts ON usage_events(ts)")
                conn.execute("INSERT INTO schema_migrations(version) VALUES (1)")
                current = 1

            if current < 2:
                # Add model aliasing to recipes
                conn.execute("ALTER TABLE recipes ADD COLUMN model_key TEXT")
                conn.execute("ALTER TABLE recipes ADD COLUMN is_default INTEGER")
                conn.execute("UPDATE recipes SET model_key = COALESCE(model_key, id)")
                conn.execute("UPDATE recipes SET is_default = COALESCE(is_default, 1)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_recipes_model_key ON recipes(model_key)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_recipes_default ON recipes(model_key, is_default)")

                # API keys (per-user tokens)
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS api_keys (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      name TEXT NOT NULL,
                      lookup TEXT NOT NULL,
                      salt BLOB NOT NULL,
                      token_hash BLOB NOT NULL,
                      scopes_json TEXT NOT NULL,
                      created_at TEXT NOT NULL,
                      last_used_at TEXT,
                      revoked_at TEXT
                    )
                    """
                )
                conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_lookup ON api_keys(lookup)")

                conn.execute("INSERT INTO schema_migrations(version) VALUES (2)")
                current = 2

            if current != SCHEMA_VERSION:
                raise RuntimeError(f"Unsupported DB schema version: {current}")

    @contextmanager
    def tx(self) -> Iterator[sqlite3.Connection]:
        with self.connect() as conn:
            yield conn
            conn.commit()
