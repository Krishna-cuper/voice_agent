from sqlmodel import SQLModel, create_engine, Session, select
from .models.case import Case
from .models.session import SessionRecord, UserStats, ChatHistory
from sqlalchemy import text
import json

# ✅ FIX: encode @ → %40
postgres_url = "postgresql://postgres:Welcome%40123@localhost:5432/postgres"

engine = create_engine(postgres_url, echo=True)


def init_db():
    # ✅ Create schema
    with engine.connect() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS myapp"))
        conn.commit()

    # ✅ Assign schema
    for table in SQLModel.metadata.tables.values():
        table.schema = "myapp"

    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:

        # -------------------------
        # Seed Cases
        # -------------------------
        if not session.exec(select(Case)).first():
            default_cases = [
                Case(title="Billing Dispute", topic="Billing", difficulty="Intermediate", channel="Both",
                     scenario="Customer is overcharged by $50.",
                     opening_message="Thank you for calling AgentUp Support. My name is Alex. How can I help you with your account today?"),

                Case(title="Angry Customer", topic="De-escalation", difficulty="Advanced", channel="Call",
                     scenario="Customer's service was cut off incorrectly.",
                     opening_message="AgentUp Support, this is Alex speaking. I hear you're having trouble with your connection—how can I assist?"),

                Case(title="Cancellation Request", topic="Retention", difficulty="Intermediate", channel="Chat",
                     scenario="Customer wants to cancel due to price.",
                     opening_message="Hi there! You've reached the AgentUp Loyalty Team. I'm here to help. What's on your mind regarding your subscription?"),

                Case(title="Technical Issue", topic="Technical", difficulty="Beginner", channel="Both",
                     scenario="Customer can't log in.",
                     opening_message="Hello! This is AgentUp Technical Support. I'm Alex. Are you having some trouble accessing your portal?"),

                Case(title="New Upgrade", topic="Sales", difficulty="Beginner", channel="Both",
                     scenario="Customer is interested in a faster plan.",
                     opening_message="Thank you for your interest in AgentUp! I'd be happy to discuss our high-speed options with you. What are you looking for?")
            ]

            session.add_all(default_cases)
            session.commit()

        # -------------------------
        # Seed User Stats
        # -------------------------
        if not session.exec(select(UserStats)).first():
            stats = UserStats(id=1, streak=7, total_sessions=15, average_score=89.0)
            session.add(stats)
            session.commit()

        # -------------------------
        # Seed Session History
        # -------------------------
        if not session.exec(select(SessionRecord)).first():

            history = [
                SessionRecord(
                    case_id=1,
                    score=85,
                    feedback="Great empathy, solved the billing issue quickly.",
                    channel="Chat",
                    transcript='[{"role":"customer","text":"Why is my bill high?"},{"role":"agent","text":"Let me check that for you."}]'
                ),
                SessionRecord(
                    case_id=2,
                    score=92,
                    feedback="Professional tone and clear resolution steps provided.",
                    channel="Call",
                    transcript='[{"role":"customer","text":"I need help with my router."},{"role":"agent","text":"I can assist you with the setup."}]'
                ),
                SessionRecord(
                    case_id=3,
                    score=74,
                    feedback="Could improve on de-escalation timing.",
                    channel="Both",
                    transcript='[{"role":"customer","text":"My delivery is late!"},{"role":"agent","text":"I am sorry for the delay."}]'
                )
            ]

            # ✅ FIX: bulk insert
            session.add_all(history)
            session.commit()

            # ✅ Insert chat history (after IDs created)
            for h in history:
                turns = json.loads(h.transcript)
                for t in turns:
                    session.add(ChatHistory(
                        session_record_id=h.id,
                        role=t["role"],
                        text=t["text"]
                    ))

            session.commit()