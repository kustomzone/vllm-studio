#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, Optional, Tuple
from datetime import datetime

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from vllmstudio.models import Recipe
from vllmstudio_controller.db import SQLiteDB
from vllmstudio_controller.stores import SQLiteRecipeStore


ALLOWED_BACKENDS = {"vllm", "sglang"}


def _iter_recipe_payloads(path: Path) -> Iterator[Dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict) and isinstance(data.get("recipes"), list):
        for item in data["recipes"]:
            if isinstance(item, dict):
                yield item
        return
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict):
                yield item
        return
    if isinstance(data, dict):
        yield data


def _raw_backend(raw: Dict[str, Any]) -> str:
    b = raw.get("backend")
    if not b:
        b = raw.get("engine")
    if not b:
        return "vllm"
    return str(b).strip().lower()


def _raw_id(raw: Dict[str, Any], *, fallback: str) -> str:
    rid = raw.get("id")
    if isinstance(rid, str) and rid.strip():
        return rid.strip()
    return fallback


def _coerce_bool(value: Any) -> Optional[bool]:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        v = value.strip().lower()
        if v in {"1", "true", "yes", "y", "on"}:
            return True
        if v in {"0", "false", "no", "n", "off"}:
            return False
    return None


def _guess_model_key(recipe: Recipe, raw: Dict[str, Any]) -> str:
    for key in ("model_key", "model_alias", "model_id", "alias"):
        if isinstance(raw.get(key), str) and raw[key].strip():
            return raw[key].strip()
    if recipe.served_model_name and recipe.served_model_name.strip():
        return recipe.served_model_name.strip()
    try:
        base = Path(recipe.model_path).name
        if base:
            return base
    except Exception:
        pass
    return recipe.id


def _maybe_default_flag(raw: Dict[str, Any]) -> Optional[bool]:
    for key in ("is_default", "default", "isDefault"):
        if key in raw:
            return _coerce_bool(raw.get(key))
    return None


def _dedupe_id(recipe_id: str, used: set[str]) -> str:
    if recipe_id not in used:
        return recipe_id
    n = 2
    while True:
        candidate = f"{recipe_id}-{n}"
        if candidate not in used:
            return candidate
        n += 1


def migrate(
    *,
    recipes_dir: Path,
    db_path: Path,
    overwrite: bool,
    dedupe: bool,
    include_unsupported_backends: bool,
    store_unsupported: bool,
    unsupported_table: str,
) -> Tuple[int, int, int]:
    db = SQLiteDB(db_path)
    db.migrate()
    store = SQLiteRecipeStore(db)

    files = sorted(recipes_dir.glob("*.json"))
    if not files:
        raise SystemExit(f"No recipe files found in {recipes_dir}")

    imported = 0
    skipped = 0
    errors = 0
    used_ids = {r.id for r in store.list()}

    for file_path in files:
        try:
            for raw in _iter_recipe_payloads(file_path):
                raw_backend = _raw_backend(raw)
                if (raw_backend not in ALLOWED_BACKENDS) and (not include_unsupported_backends):
                    if store_unsupported:
                        recipe_id = _raw_id(raw, fallback=file_path.stem)
                        with db.tx() as conn:
                            conn.execute(
                                f"""
                                CREATE TABLE IF NOT EXISTS {unsupported_table} (
                                  id TEXT PRIMARY KEY,
                                  backend TEXT,
                                  json TEXT NOT NULL,
                                  imported_at TEXT NOT NULL
                                )
                                """
                            )
                            conn.execute(
                                f"INSERT OR REPLACE INTO {unsupported_table}(id, backend, json, imported_at) VALUES (?,?,?,?)",
                                (recipe_id, raw_backend, json.dumps(raw, ensure_ascii=False), datetime.utcnow().isoformat()),
                            )
                    skipped += 1
                    continue

                recipe = Recipe(**raw)

                if store.get(recipe.id) and not overwrite:
                    skipped += 1
                    continue

                if dedupe:
                    new_id = _dedupe_id(recipe.id, used_ids)
                    if new_id != recipe.id:
                        recipe = recipe.model_copy(update={"id": new_id})

                model_key = _guess_model_key(recipe, raw)
                is_default = _maybe_default_flag(raw)
                store.upsert(recipe, model_key=model_key, is_default=is_default)
                used_ids.add(recipe.id)
                imported += 1
        except Exception as e:
            print(f"[error] {file_path}: {e.__class__.__name__}: {e}", file=sys.stderr)
            errors += 1

    return imported, skipped, errors


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate JSON recipes into vllmstudio_controller SQLite DB.")
    parser.add_argument("--recipes-dir", type=Path, default=Path("recipes"), help="Directory containing *.json recipes.")
    parser.add_argument("--db", type=Path, default=Path("data/controller.db"), help="Controller SQLite DB path.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing recipe ids in DB.")
    parser.add_argument("--no-dedupe", action="store_true", help="Disable auto-deduping of duplicate recipe ids.")
    parser.add_argument(
        "--include-unsupported-backends",
        action="store_true",
        help="Import non-vllm/sglang recipes into the main recipes table (may break older controller binaries).",
    )
    parser.add_argument(
        "--no-store-unsupported",
        action="store_true",
        help="Do not store unsupported recipes anywhere (default: store in legacy table).",
    )
    parser.add_argument("--unsupported-table", type=str, default="legacy_recipes_raw", help="SQLite table for unsupported recipes.")
    args = parser.parse_args()

    imported, skipped, errors = migrate(
        recipes_dir=args.recipes_dir,
        db_path=args.db,
        overwrite=args.overwrite,
        dedupe=not args.no_dedupe,
        include_unsupported_backends=args.include_unsupported_backends,
        store_unsupported=not args.no_store_unsupported,
        unsupported_table=args.unsupported_table,
    )

    print(f"Imported: {imported}")
    print(f"Skipped (existing): {skipped}")
    print(f"Errors: {errors}")


if __name__ == "__main__":
    main()
