from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from .database import engine, init_db
from .models.case import Case
from .models.session import SessionRecord, UserStats, ChatHistory
from .services.ai_service import AIService
import os

app = FastAPI(title="AgentUp API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/cases")
def get_cases():
    with Session(engine) as session:
        return session.exec(select(Case)).all()

@app.post("/cases")
def create_case(case: Case):
    with Session(engine) as session:
        session.add(case)
        session.commit()
        session.refresh(case)
        return case



@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    # AI service handles transcription
    ai_service = AIService()
    try:
        text = await ai_service.transcribe_audio(file)
        return {"text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/start-session")
async def start_session(data: dict):
    case_id = data.get("case_id")
    opening_message = data.get("opening_message", "")
    with Session(engine) as session:
        record = SessionRecord(case_id=case_id, channel=data.get("channel", "Voice"))
        session.add(record)
        session.commit()
        session.refresh(record)
        
        # Save opening message
        if opening_message:
            chat_turn = ChatHistory(
                session_record_id=record.id,
                role="customer",
                text=opening_message
            )
            session.add(chat_turn)
            session.commit()
            
        return {"session_id": record.id}

@app.post("/respond-stream")
async def respond_stream(data: dict):
    context = data.get("context", "")
    message = data.get("message", "")
    difficulty = data.get("difficulty", "Intermediate")
    history = data.get("history", [])
    session_id = data.get("session_id")
    
    ai_service = AIService()
    
    # Store Agent message first
    if session_id:
        with Session(engine) as session:
            agent_turn = ChatHistory(session_record_id=session_id, role="agent", text=message)
            session.add(agent_turn)
            session.commit()

    async def generate():
        full_text = ""
        async for chunk in ai_service.get_ai_response_stream(context, message, difficulty, history):
            full_text += chunk
            yield chunk
        
        # After completion, store AI's response
        if session_id:
            with Session(engine) as session:
                customer_turn = ChatHistory(session_record_id=session_id, role="customer", text=full_text)
                session.add(customer_turn)
                session.commit()

    return StreamingResponse(generate(), media_type="text/plain")

@app.post("/score")
async def get_score(data: dict):
    history = data.get("history", [])
    ai_service = AIService()
    score_data = await ai_service.score_interaction(history)
    return score_data

@app.post("/record")
async def record_session(record_data: dict):
    session_id = record_data.get("session_id")
    with Session(engine) as session:
        if session_id:
            db_record = session.get(SessionRecord, session_id)
            if db_record:
                db_record.score = record_data.get("score", 0)
                db_record.feedback = record_data.get("feedback", "")
                db_record.transcript = record_data.get("transcript", "[]")
                session.add(db_record)
                session.commit()
                
                # Update stats
                stats = session.exec(select(UserStats)).first()
                if not stats:
                    stats = UserStats(id=1, streak=1, total_sessions=0, average_score=0.0)
                    session.add(stats)
                
                stats.total_sessions += 1
                stats.average_score = (stats.average_score * (stats.total_sessions - 1) + db_record.score) / stats.total_sessions
                stats.streak += 1 
                session.add(stats)
                session.commit()
                return {"status": "success", "id": db_record.id}

        # Fallback to creating new if no session_id
        new_record = SessionRecord(
            case_id=record_data.get("case_id"),
            score=record_data.get("score", 0),
            feedback=record_data.get("feedback", ""),
            transcript=record_data.get("transcript", "[]"),
            channel=record_data.get("channel", "Voice")
        )
        session.add(new_record)
        session.commit()
        return {"status": "success", "id": new_record.id}

@app.get("/stats")
async def get_stats():
    with Session(engine) as session:
        stats = session.exec(select(UserStats)).first()
        if not stats:
            stats = UserStats(id=1, streak=1, total_sessions=0, average_score=0.0)
        return stats

@app.get("/history")
async def get_history():
    with Session(engine) as session:
        # Join Case to get title and topic
        statement = select(
            SessionRecord, 
            Case.title.label("case_title"), 
            Case.topic.label("case_topic")
        ).join(Case, SessionRecord.case_id == Case.id).order_by(SessionRecord.timestamp.desc()).limit(100)
        
        results = session.exec(statement).all()
        
        # Flatten results for easier consumption
        history = []
        for record, title, topic in results:
            item = record.dict()
            item["title"] = title
            item["topic"] = topic
            history.append(item)
            
        return history

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
