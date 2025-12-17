from __future__ import annotations

import hashlib
import hmac
import json
import os
from dataclasses import dataclass
from datetime import datetime
from typing import Iterable, Optional

from .db import SQLiteDB


PBKDF2_ITERS = 120_000


@dataclass(frozen=True)
class Principal:
    token_id: Optional[int]
    name: str
    scopes: set[str]
    is_admin: bool = False

    def has(self, scope: str) -> bool:
        return self.is_admin or (scope in self.scopes)


def _now() -> str:
    return datetime.utcnow().isoformat()


def _lookup_from_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()[:12]


def _hash_token(token: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", token.encode("utf-8"), salt, PBKDF2_ITERS)


def generate_token() -> str:
    return "sk-" + hashlib.sha256(os.urandom(32)).hexdigest()


def create_api_key(
    db: SQLiteDB,
    *,
    name: str,
    token: str,
    scopes: Iterable[str],
) -> int:
    salt = os.urandom(16)
    token_hash = _hash_token(token, salt)
    scopes_json = json.dumps(sorted(set(scopes)), ensure_ascii=False)
    lookup = _lookup_from_token(token)
    with db.tx() as conn:
        cur = conn.execute(
            """
            INSERT INTO api_keys(name, lookup, salt, token_hash, scopes_json, created_at)
            VALUES (?,?,?,?,?,?)
            """,
            (name, lookup, salt, token_hash, scopes_json, _now()),
        )
        return int(cur.lastrowid)


def revoke_api_key(db: SQLiteDB, key_id: int) -> bool:
    with db.tx() as conn:
        cur = conn.execute("UPDATE api_keys SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL", (_now(), key_id))
        return cur.rowcount > 0


def list_api_keys(db: SQLiteDB) -> list[dict]:
    with db.tx() as conn:
        rows = conn.execute(
            "SELECT id, name, scopes_json, created_at, last_used_at, revoked_at FROM api_keys ORDER BY id DESC"
        ).fetchall()
    return [
        {
            "id": int(r["id"]),
            "name": r["name"],
            "scopes": json.loads(r["scopes_json"] or "[]"),
            "created_at": r["created_at"],
            "last_used_at": r["last_used_at"],
            "revoked_at": r["revoked_at"],
        }
        for r in rows
    ]


def authenticate(db: SQLiteDB, token: str) -> Optional[Principal]:
    lookup = _lookup_from_token(token)
    with db.tx() as conn:
        row = conn.execute(
            "SELECT id, name, salt, token_hash, scopes_json FROM api_keys WHERE lookup = ? AND revoked_at IS NULL",
            (lookup,),
        ).fetchone()
        if not row:
            return None
        expected = row["token_hash"]
        computed = _hash_token(token, row["salt"])
        if not hmac.compare_digest(expected, computed):
            return None
        conn.execute("UPDATE api_keys SET last_used_at = ? WHERE id = ?", (_now(), int(row["id"])))
    scopes = set(json.loads(row["scopes_json"] or "[]"))
    return Principal(token_id=int(row["id"]), name=row["name"], scopes=scopes, is_admin=False)

