"""SQLite-backed recipe store."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional

from vllmstudio.models import Recipe

from ..db import SQLiteDB


@dataclass(frozen=True)
class RecipeRecord:
    recipe: Recipe
    model_key: str
    is_default: bool


@dataclass(frozen=True)
class SQLiteRecipeStore:
    db: SQLiteDB

    def list(self) -> List[Recipe]:
        with self.db.tx() as conn:
            rows = conn.execute("SELECT json FROM recipes ORDER BY id ASC").fetchall()
        return [Recipe(**json.loads(r["json"])) for r in rows]

    def get(self, recipe_id: str) -> Optional[Recipe]:
        with self.db.tx() as conn:
            row = conn.execute("SELECT json FROM recipes WHERE id = ?", (recipe_id,)).fetchone()
        if not row:
            return None
        return Recipe(**json.loads(row["json"]))

    def list_records(self) -> List[RecipeRecord]:
        with self.db.tx() as conn:
            rows = conn.execute(
                "SELECT json, model_key, is_default FROM recipes ORDER BY model_key ASC, is_default DESC, id ASC"
            ).fetchall()
        out: List[RecipeRecord] = []
        for r in rows:
            recipe = Recipe(**json.loads(r["json"]))
            model_key = r["model_key"] or recipe.id
            is_default = bool(r["is_default"]) if r["is_default"] is not None else True
            out.append(RecipeRecord(recipe=recipe, model_key=model_key, is_default=is_default))
        return out

    def get_record(self, recipe_id: str) -> Optional[RecipeRecord]:
        with self.db.tx() as conn:
            row = conn.execute(
                "SELECT json, model_key, is_default FROM recipes WHERE id = ?",
                (recipe_id,),
            ).fetchone()
        if not row:
            return None
        recipe = Recipe(**json.loads(row["json"]))
        model_key = row["model_key"] or recipe.id
        is_default = bool(row["is_default"]) if row["is_default"] is not None else True
        return RecipeRecord(recipe=recipe, model_key=model_key, is_default=is_default)

    def get_default_for_model_key(self, model_key: str) -> Optional[RecipeRecord]:
        with self.db.tx() as conn:
            row = conn.execute(
                """
                SELECT json, model_key, is_default
                FROM recipes
                WHERE model_key = ?
                ORDER BY is_default DESC, updated_at DESC, id ASC
                LIMIT 1
                """,
                (model_key,),
            ).fetchone()
        if not row:
            return None
        recipe = Recipe(**json.loads(row["json"]))
        return RecipeRecord(recipe=recipe, model_key=row["model_key"] or recipe.id, is_default=bool(row["is_default"]))

    def list_model_keys(self) -> List[dict]:
        with self.db.tx() as conn:
            rows = conn.execute(
                """
                SELECT model_key, GROUP_CONCAT(id) AS recipe_ids
                FROM recipes
                GROUP BY model_key
                ORDER BY model_key ASC
                """
            ).fetchall()
        out: List[dict] = []
        for r in rows:
            mk = r["model_key"]
            default = self.get_default_for_model_key(mk)
            recipe_ids = (r["recipe_ids"] or "").split(",") if r["recipe_ids"] else []
            out.append(
                {
                    "model_key": mk,
                    "default_recipe_id": default.recipe.id if default else None,
                    "recipe_ids": recipe_ids,
                }
            )
        return out

    def set_default(self, recipe_id: str) -> Optional[RecipeRecord]:
        record = self.get_record(recipe_id)
        if not record:
            return None
        with self.db.tx() as conn:
            conn.execute("UPDATE recipes SET is_default = 0 WHERE model_key = ?", (record.model_key,))
            conn.execute(
                "UPDATE recipes SET is_default = 1, updated_at = ? WHERE id = ?",
                (datetime.utcnow().isoformat(), recipe_id),
            )
        return self.get_record(recipe_id)

    def upsert(self, recipe: Recipe, *, model_key: Optional[str] = None, is_default: Optional[bool] = None) -> Recipe:
        now = datetime.utcnow().isoformat()
        payload = json.dumps(recipe.model_dump(), ensure_ascii=False)
        with self.db.tx() as conn:
            existing = conn.execute(
                "SELECT model_key, is_default FROM recipes WHERE id = ?",
                (recipe.id,),
            ).fetchone()

            effective_model_key = (model_key or (existing["model_key"] if existing else None) or recipe.id).strip()
            if not effective_model_key:
                effective_model_key = recipe.id

            effective_is_default: bool
            if is_default is None:
                if existing and existing["is_default"] is not None:
                    effective_is_default = bool(existing["is_default"])
                else:
                    # First recipe under this model_key becomes default unless explicitly set.
                    other_default = conn.execute(
                        "SELECT 1 FROM recipes WHERE model_key = ? AND is_default = 1 LIMIT 1",
                        (effective_model_key,),
                    ).fetchone()
                    effective_is_default = other_default is None
            else:
                effective_is_default = bool(is_default)

            if effective_is_default:
                conn.execute("UPDATE recipes SET is_default = 0 WHERE model_key = ?", (effective_model_key,))

            if existing:
                conn.execute(
                    "UPDATE recipes SET json = ?, model_key = ?, is_default = ?, updated_at = ? WHERE id = ?",
                    (payload, effective_model_key, int(effective_is_default), now, recipe.id),
                )
            else:
                conn.execute(
                    "INSERT INTO recipes(id, json, model_key, is_default, created_at, updated_at) VALUES (?,?,?,?,?,?)",
                    (recipe.id, payload, effective_model_key, int(effective_is_default), now, now),
                )
        return recipe

    def delete(self, recipe_id: str) -> bool:
        with self.db.tx() as conn:
            cur = conn.execute("DELETE FROM recipes WHERE id = ?", (recipe_id,))
        return cur.rowcount > 0
