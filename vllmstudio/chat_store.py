"""Chat history persistence using SQLite."""

import json
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, Any
from pydantic import BaseModel


class ChatMessage(BaseModel):
    """A single chat message."""
    id: str
    role: str  # 'user', 'assistant', 'system'
    content: str
    created_at: str
    model: Optional[str] = None
    tool_calls: Optional[list] = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    estimated_cost_usd: Optional[float] = None


class ChatSession(BaseModel):
    """A chat session with messages."""
    id: str
    title: str
    model: Optional[str] = None
    parent_id: Optional[str] = None
    forked_from_message_id: Optional[str] = None
    root_id: Optional[str] = None
    created_at: str
    updated_at: str
    messages: list[ChatMessage] = []


class ChatStore:
    """SQLite-based chat history storage."""

    def __init__(self, db_path: Optional[Path] = None):
        if db_path is None:
            db_path = Path(__file__).parent.parent / "data" / "chats.db"

        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    @staticmethod
    def _table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
        rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
        return {r[1] for r in rows}

    @staticmethod
    def _ensure_column(conn: sqlite3.Connection, table: str, column: str, col_type: str) -> None:
        cols = ChatStore._table_columns(conn, table)
        if column in cols:
            return
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")

    def _init_db(self):
        """Initialize database tables."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    model TEXT,
                    parent_id TEXT,
                    forked_from_message_id TEXT,
                    root_id TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    model TEXT,
                    tool_calls TEXT,
                    prompt_tokens INTEGER,
                    completion_tokens INTEGER,
                    total_tokens INTEGER,
                    estimated_cost_usd REAL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
                )
            """)
            # Lightweight migrations for older DBs
            self._ensure_column(conn, "sessions", "parent_id", "TEXT")
            self._ensure_column(conn, "sessions", "forked_from_message_id", "TEXT")
            self._ensure_column(conn, "sessions", "root_id", "TEXT")
            self._ensure_column(conn, "messages", "prompt_tokens", "INTEGER")
            self._ensure_column(conn, "messages", "completion_tokens", "INTEGER")
            self._ensure_column(conn, "messages", "total_tokens", "INTEGER")
            self._ensure_column(conn, "messages", "estimated_cost_usd", "REAL")

            conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)")
            conn.commit()

    def list_sessions(self, limit: int = 50) -> list[ChatSession]:
        """List all chat sessions (without messages)."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT * FROM sessions ORDER BY updated_at DESC LIMIT ?",
                (limit,)
            ).fetchall()

            return [
                ChatSession(
                    id=row["id"],
                    title=row["title"],
                    model=row["model"],
                    parent_id=row["parent_id"] if "parent_id" in row.keys() else None,
                    forked_from_message_id=row["forked_from_message_id"] if "forked_from_message_id" in row.keys() else None,
                    root_id=row["root_id"] if "root_id" in row.keys() else None,
                    created_at=row["created_at"],
                    updated_at=row["updated_at"],
                    messages=[]
                )
                for row in rows
            ]

    def get_session(self, session_id: str) -> Optional[ChatSession]:
        """Get a session with all its messages."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row

            session_row = conn.execute(
                "SELECT * FROM sessions WHERE id = ?",
                (session_id,)
            ).fetchone()

            if not session_row:
                return None

            message_rows = conn.execute(
                "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC",
                (session_id,)
            ).fetchall()

            messages = [
                ChatMessage(
                    id=row["id"],
                    role=row["role"],
                    content=row["content"],
                    model=row["model"],
                    tool_calls=json.loads(row["tool_calls"]) if row["tool_calls"] else None,
                    prompt_tokens=int(row["prompt_tokens"] or 0),
                    completion_tokens=int(row["completion_tokens"] or 0),
                    total_tokens=int(row["total_tokens"] or 0),
                    estimated_cost_usd=float(row["estimated_cost_usd"]) if row["estimated_cost_usd"] is not None else None,
                    created_at=row["created_at"]
                )
                for row in message_rows
            ]

            return ChatSession(
                id=session_row["id"],
                title=session_row["title"],
                model=session_row["model"],
                parent_id=session_row["parent_id"] if "parent_id" in session_row.keys() else None,
                forked_from_message_id=session_row["forked_from_message_id"] if "forked_from_message_id" in session_row.keys() else None,
                root_id=session_row["root_id"] if "root_id" in session_row.keys() else None,
                created_at=session_row["created_at"],
                updated_at=session_row["updated_at"],
                messages=messages
            )

    def create_session(
        self,
        title: str = "New Chat",
        model: Optional[str] = None,
        parent_id: Optional[str] = None,
        forked_from_message_id: Optional[str] = None,
        root_id: Optional[str] = None,
    ) -> ChatSession:
        """Create a new chat session."""
        session_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        root = root_id or (parent_id or session_id)

        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT INTO sessions (id, title, model, parent_id, forked_from_message_id, root_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (session_id, title, model, parent_id, forked_from_message_id, root, now, now)
            )
            conn.commit()

        return ChatSession(
            id=session_id,
            title=title,
            model=model,
            parent_id=parent_id,
            forked_from_message_id=forked_from_message_id,
            root_id=root,
            created_at=now,
            updated_at=now,
            messages=[]
        )

    def update_session(self, session_id: str, title: Optional[str] = None, model: Optional[str] = None) -> bool:
        """Update session metadata."""
        updates = []
        params = []

        if title is not None:
            updates.append("title = ?")
            params.append(title)
        if model is not None:
            updates.append("model = ?")
            params.append(model)

        if not updates:
            return True

        updates.append("updated_at = ?")
        params.append(datetime.utcnow().isoformat())
        params.append(session_id)

        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                f"UPDATE sessions SET {', '.join(updates)} WHERE id = ?",
                params
            )
            conn.commit()
            return cursor.rowcount > 0

    def fork_session(
        self,
        session_id: str,
        *,
        title: Optional[str] = None,
        model: Optional[str] = None,
        message_id: Optional[str] = None,
    ) -> Optional[ChatSession]:
        """Create a new session that copies messages from an existing session (optionally up to a message id)."""
        source = self.get_session(session_id)
        if not source:
            return None

        messages_to_copy = source.messages
        forked_from_message_id = message_id
        if message_id:
            prefix: list[ChatMessage] = []
            for m in source.messages:
                prefix.append(m)
                if m.id == message_id:
                    break
            messages_to_copy = prefix

        if not forked_from_message_id and messages_to_copy:
            forked_from_message_id = messages_to_copy[-1].id

        new_title = title or f"{source.title} (fork)"
        new_model = model if model is not None else source.model

        fork = self.create_session(
            title=new_title,
            model=new_model,
            parent_id=source.id,
            forked_from_message_id=forked_from_message_id,
            root_id=source.root_id or source.id,
        )

        for msg in messages_to_copy:
            self.add_message(
                session_id=fork.id,
                role=msg.role,
                content=msg.content,
                model=msg.model,
                tool_calls=msg.tool_calls,
            )

        return self.get_session(fork.id)

    def get_session_usage(self, session_id: str) -> Optional[dict[str, Any]]:
        """Return token usage totals for a session."""
        session = self.get_session(session_id)
        if not session:
            return None

        prompt = sum(m.prompt_tokens for m in session.messages)
        completion = sum(m.completion_tokens for m in session.messages)
        total = sum(m.total_tokens for m in session.messages)
        costs = [m.estimated_cost_usd for m in session.messages if m.estimated_cost_usd is not None]

        return {
            "session_id": session_id,
            "prompt_tokens": prompt,
            "completion_tokens": completion,
            "total_tokens": total,
            "estimated_cost_usd": float(sum(costs)) if costs else None,
        }

    def delete_session(self, session_id: str) -> bool:
        """Delete a chat session and all its messages."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
            cursor = conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
            conn.commit()
            return cursor.rowcount > 0

    def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        model: Optional[str] = None,
        tool_calls: Optional[list] = None,
        message_id: Optional[str] = None,
    ) -> ChatMessage:
        """Add a message to a session."""
        msg_id = message_id or str(uuid.uuid4())
        now = datetime.utcnow().isoformat()

        from .token_counter import TokenCounter
        from .pricing import estimate_cost_usd

        model_for_count = model or "default"
        msg_payload: dict[str, Any] = {"role": role, "content": content}
        if tool_calls:
            msg_payload["tool_calls"] = tool_calls
        token_count = TokenCounter.count_message_tokens([msg_payload], model_for_count)

        prompt_tokens = token_count if role in ("user", "system", "tool") else 0
        completion_tokens = token_count if role == "assistant" else 0
        total_tokens = token_count
        estimated_cost = estimate_cost_usd(model_for_count, prompt_tokens, completion_tokens)

        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """INSERT INTO messages (
                      id, session_id, role, content, model, tool_calls,
                      prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd,
                      created_at
                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    msg_id,
                    session_id,
                    role,
                    content,
                    model,
                    json.dumps(tool_calls) if tool_calls else None,
                    prompt_tokens,
                    completion_tokens,
                    total_tokens,
                    estimated_cost,
                    now
                )
            )
            conn.execute(
                "UPDATE sessions SET updated_at = ? WHERE id = ?",
                (now, session_id)
            )
            conn.commit()

        return ChatMessage(
            id=msg_id,
            role=role,
            content=content,
            model=model,
            tool_calls=tool_calls,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            estimated_cost_usd=estimated_cost,
            created_at=now
        )


# Global instance
chat_store = ChatStore()
