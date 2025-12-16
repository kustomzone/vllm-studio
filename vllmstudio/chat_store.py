"""Chat history persistence using SQLite."""

import json
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional
from pydantic import BaseModel


class ChatMessage(BaseModel):
    """A single chat message."""
    id: str
    role: str  # 'user', 'assistant', 'system'
    content: str
    created_at: str
    model: Optional[str] = None
    tool_calls: Optional[list] = None


class ChatSession(BaseModel):
    """A chat session with messages."""
    id: str
    title: str
    model: Optional[str] = None
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

    def _init_db(self):
        """Initialize database tables."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    model TEXT,
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
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
                )
            """)
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
                    created_at=row["created_at"]
                )
                for row in message_rows
            ]

            return ChatSession(
                id=session_row["id"],
                title=session_row["title"],
                model=session_row["model"],
                created_at=session_row["created_at"],
                updated_at=session_row["updated_at"],
                messages=messages
            )

    def create_session(self, title: str = "New Chat", model: Optional[str] = None) -> ChatSession:
        """Create a new chat session."""
        session_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()

        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT INTO sessions (id, title, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (session_id, title, model, now, now)
            )
            conn.commit()

        return ChatSession(
            id=session_id,
            title=title,
            model=model,
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
        tool_calls: Optional[list] = None
    ) -> ChatMessage:
        """Add a message to a session."""
        message_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()

        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """INSERT INTO messages (id, session_id, role, content, model, tool_calls, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    message_id,
                    session_id,
                    role,
                    content,
                    model,
                    json.dumps(tool_calls) if tool_calls else None,
                    now
                )
            )
            conn.execute(
                "UPDATE sessions SET updated_at = ? WHERE id = ?",
                (now, session_id)
            )
            conn.commit()

        return ChatMessage(
            id=message_id,
            role=role,
            content=content,
            model=model,
            tool_calls=tool_calls,
            created_at=now
        )


# Global instance
chat_store = ChatStore()
