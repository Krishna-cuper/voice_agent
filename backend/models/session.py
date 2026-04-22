from sqlmodel import SQLModel, Field
from typing import Optional, List
from datetime import datetime

class SessionRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    case_id: int
    score: int = 0
    feedback: str = "In Progress"
    transcript: str = "[]"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    channel: str = "Voice"

class UserStats(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    streak: int = 0
    total_sessions: int = 0
    average_score: float = 0.0

class ChatHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_record_id: int = Field(foreign_key="sessionrecord.id")
    role: str
    text: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
