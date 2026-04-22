from sqlmodel import SQLModel, Field
from typing import Optional

class Case(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    topic: str
    difficulty: str  # Beginner, Intermediate, Advanced
    channel: str     # Chat, Call, Both
    scenario: str
    opening_message: str
