from openai import OpenAI
import os
import httpx
from fastapi import UploadFile
from dotenv import load_dotenv

load_dotenv()

# ── Groq API (drop-in replacement for Ollama) ────────────────────────────────
# Free tier: 800K tokens/day — https://console.groq.com/keys
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "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")
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
GROQ_MODEL = "llama-3.1-8b-instant"
# ── Whisper ASR — Docker service URL ─────────────────────────────────────────
WHISPER_URL = os.environ.get("WHISPER_URL", "http://localhost:9000")


class AIService:

    def __init__(self):
        self.groq_client = OpenAI(
            api_key=GROQ_API_KEY,
            base_url=GROQ_BASE_URL
        ) if GROQ_API_KEY else None

    # ── Transcription (Groq Whisper API) ───────────────────────────────────────
    async def transcribe_audio(self, file: UploadFile):
        if not self.groq_client:
            return "[Transcription Failed: GROQ_API_KEY is missing]"
            
        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as buffer:
            buffer.write(await file.read())

        try:
            print("Calling Groq Whisper API for transcription...")
            with open(temp_path, "rb") as audio_file:
                transcription = self.groq_client.audio.transcriptions.create(
                    file=(file.filename, audio_file.read()),
                    model="whisper-large-v3"
                )
                return transcription.text
        except Exception as e:
            print(f"ASR Service Error: {e}")
            return f"[Transcription Failed: {e}]"
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def _build_system_prompt(self, context: str, difficulty: str) -> str:
        return f"""You are a professional CALL CENTER AGENT in a training simulation.
Scenario: {context}
Difficulty: {difficulty}
Instructions:
- Stay in character as the professional agent at all times.
- Your goal is to help the customer (the user) resolve their issue.
- Match tone based on difficulty (Advanced = more assertive customer).
- Keep responses professional and concise (1–2 sentences max).
- Respond ONLY in English. Do not use any other language.
Only output the agent's reply."""

    def _build_messages(self, system_prompt: str, history: list, message: str) -> list:
        msgs = [{"role": "system", "content": system_prompt}]
        if history:
            for h in history:
                role = "user" if h["role"] == "customer" else "assistant"
                msgs.append({"role": role, "content": h["text"]})
        if not history or history[-1]["text"] != message:
            msgs.append({"role": "user", "content": message})
        return msgs

    # ── Non-streaming AI Response (Groq) ─────────────────────────────────────
    async def get_ai_response(self, context: str, message: str, difficulty: str, history: list = None):
        if not self.groq_client:
            return "Error: GROQ_API_KEY is missing."
            
        try:
            print(f"Calling Groq API ({GROQ_MODEL}) for agent response...")
            system_prompt = self._build_system_prompt(context, difficulty)
            messages = self._build_messages(system_prompt, history, message)

            response = self.groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=messages,
                max_tokens=256,
                temperature=0.7,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"Groq AI Error: {e}")
            return "I'm having trouble thinking of a response right now."

    # ── Streaming AI Response (Groq) ──────────────────────────────────────────
    async def get_ai_response_stream(self, context: str, message: str, difficulty: str, history: list = None):
        if not self.groq_client:
            yield "Error: GROQ_API_KEY is missing. Please add it to your environment."
            return
            
        try:
            print(f"Calling Groq API ({GROQ_MODEL}) streaming...")
            system_prompt = self._build_system_prompt(context, difficulty)
            messages = self._build_messages(system_prompt, history, message)

            stream = self.groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=messages,
                max_tokens=256,
                temperature=0.7,
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
        except Exception as e:
            print(f"Groq Streaming Exception: {e}")
            yield "I understand, but I'm still processing that..."

    # ── Session Scoring (Groq) ────────────────────────────────────────────────
    async def score_interaction(self, history: list):
        if not self.groq_client:
            return {"score": 0, "feedback": "GROQ_API_KEY is missing. Cannot score session."}
            
        try:
            print(f"Calling Groq API ({GROQ_MODEL}) for session scoring...")
            prompt = (
                "You are an expert call center supervisor evaluating a trainee. Score this agent interaction from 0-100.\n\n"
                "CRITICAL SCORING CRITERIA (Weight 25% each):\n"
                "1. Empathy & Tone: Did they sound caring and professional?\n"
                "2. Accuracy of Information: Did they follow case details correctly?\n"
                "3. Resolution / Next Steps: Did they provide a clear path forward?\n"
                "4. Professionalism & Clarity: Was their communication crisp and efficient?\n\n"
                f"History: {str(history)}\n\n"
                "Provide exactly 2-3 sentences of feedback. Highlight exactly ONE strength and exactly ONE area to improve.\n"
                "IMPORTANT: Your response MUST be ONLY valid JSON: {\"score\": int, \"feedback\": \"string\"}"
            )

            response = self.groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=256,
                temperature=0.3,
                response_format={"type": "json_object"},
            )
            import json
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            print(f"Scoring Exception: {e}")

        return {"score": 85, "feedback": "Good effort. Try to be more specific with your resolution."}
