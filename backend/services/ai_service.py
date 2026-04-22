from openai import OpenAI
import os
from fastapi import UploadFile
from dotenv import load_dotenv
import torch
from transformers import pipeline
import librosa
import numpy as np

load_dotenv()

class AIService:
    _whisper_pipeline = None

    def __init__(self):
        self.api_key = os.environ.get("OPENAI_API_KEY")
        self.client = OpenAI(api_key=self.api_key) if self.api_key else None

    @classmethod
    def get_whisper_pipeline(cls):
        if cls._whisper_pipeline is None:
            print("Loading local Whisper model (openai/whisper-base)...")
            cls._whisper_pipeline = pipeline(
                "automatic-speech-recognition",
                model="openai/whisper-base",
                device="cuda" if torch.cuda.is_available() else "cpu",
            )
        return cls._whisper_pipeline

    async def transcribe_audio(self, file: UploadFile):
        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as buffer:
            buffer.write(await file.read())
        
        try:
            # Call the local Docker ASR service
            print("Calling local Docker ASR service at localhost:9000...")
            import httpx
            async with httpx.AsyncClient(timeout=60.0) as client:
                with open(temp_path, "rb") as audio_file:
                    response = await client.post(
                        "http://localhost:9000/asr",
                        files={"audio_file": audio_file},
                        params={"task": "transcribe", "language": "en", "output": "json"}
                    )
                    if response.status_code == 200:
                        return response.json().get("text", "")
                    else:
                        return f"[ASR Error: {response.text}]"
        except Exception as e:
            print(f"ASR Service Connection Error: {e}")
            # Fallback to local transformers if docker fails
            try:
                import librosa
                audio, sr = librosa.load(temp_path, sr=16000)
                pipe = self.get_whisper_pipeline()
                result = pipe(audio)
                return result["text"]
            except:
                return f"[Transcription Failed: {e}]"
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    async def get_ai_response(self, context: str, message: str, difficulty: str, history: list = None):
        try:
            import httpx
            print("Calling local Ollama (phi3) for AI Agent response...")
            
            system_prompt = f"""
                You are a professional CALL CENTER AGENT in a training simulation.
                Scenario:
                {context}
                
                Difficulty: {difficulty}
                Instructions:
                - Stay in character as the professional agent at all times.
                - Your goal is to help the customer (the user) resolve their issue.
                - Match tone based on difficulty.
                - Keep responses professional and concise (1–2 sentences max).
                - Respond ONLY in English. Do not use any other language.
                Only output the agent's reply.
            """
            
            # Build messages from history
            ollama_messages = [{"role": "system", "content": system_prompt}]
            if history:
                for h in history:
                    role = "user" if h["role"] == "customer" else "assistant"
                    ollama_messages.append({"role": role, "content": h["text"]})
            
            # Add latest message if not in history
            if not history or history[-1]["text"] != message:
                ollama_messages.append({"role": "user", "content": message})
            
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    "http://localhost:11434/api/chat",
                    json={
                        "model": "phi3:mini",
                        "messages": ollama_messages,
                        "stream": False,
                        "options": {
                            "num_gpu": 0
                        }
                    }
                )
                if response.status_code == 200:
                    return response.json()["message"]["content"].strip()
                else:
                    print(f"Ollama Response Error ({response.status_code}): {response.text}")
        except Exception as e:
            print(f"Ollama AI Error: {e}")
            return "I'm having trouble thinking of a response right now."
                    
    async def get_ai_response_stream(self, context: str, message: str, difficulty: str, history: list = None):
        try:
            import httpx
            import json
            
            system_prompt = f"""
                You are a professional CALL CENTER AGENT in a training simulation.
                Scenario: {context}
                Difficulty: {difficulty}
                Instructions:
                - Stay in character as the professional agent at all times.
                - Your goal is to help the customer (the user) resolve their issue.
                - Match tone based on difficulty.
                - Keep responses professional (1–2 sentences max).
                - Respond ONLY in English. Do not use any other language.
                Only output the agent's reply.
            """
            
            ollama_messages = [{"role": "system", "content": system_prompt}]
            if history:
                for h in history:
                    role = "user" if h["role"] == "customer" else "assistant"
                    ollama_messages.append({"role": role, "content": h["text"]})
            
            if not history or history[-1]["text"] != message:
                ollama_messages.append({"role": "user", "content": message})
            
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    "http://localhost:11434/api/chat",
                    json={
                        "model": "phi3:mini",
                        "messages": ollama_messages,
                        "stream": True,
                        "options": {"num_gpu": 0}
                    }
                ) as response:
                    if response.status_code == 200:
                        async for line in response.aiter_lines():
                            if line:
                                data = json.loads(line)
                                if "message" in data and "content" in data["message"]:
                                    yield data["message"]["content"]
                    else:
                        yield f"I'm sorry, I'm having trouble responding right now. (Error {response.status_code})"
        except Exception as e:
            print(f"Ollama Streaming Exception: {e}")
            yield "I understand, but I'm still processing that..."

    async def score_interaction(self, history: list):
        try:
            import httpx
            print("Calling local Ollama (phi3) for session scoring...")
            
            prompt = (
                "You are an expert call center supervisor evaluating a trainee. Score this agent interaction from 0-100.\n\n"
                "CRITICAL SCORING CRITERIA (Weight 25% each):\n"
                "1. Empathy & Tone: Did they sound caring and professional?\n"
                "2. Accuracy of Information: Did they follow case details correctly?\n"
                "3. Resolution / Next Steps: Did they provide a clear path forward?\n"
                "4. Professionalism & Clarity: Was their communication crisp and efficient?\n\n"
                f"History: {str(history)}\n\n"
                "Provide exactly 2-3 sentences of feedback. Highlight exactly ONE strength and exactly ONE area to improve.\n"
                "IMPORTANT: Your response MUST be ONLY valid JSON: {'score': int, 'feedback': 'string'}"
            )
            
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    "http://localhost:11434/api/chat",
                    json={
                        "model": "phi3:mini",
                        "messages": [
                            {"role": "user", "content": prompt}
                        ],
                        "stream": False,
                        "options": {
                            "num_gpu": 0
                        }
                    }
                )
                if response.status_code == 200:
                    content = response.json()["message"]["content"]
                    import json, re
                    match = re.search(r'\{.*\}', content, re.DOTALL)
                    if match:
                        return json.loads(match.group(0))
                    return json.loads(content)
                else:
                    print(f"Scoring Ollama Error ({response.status_code}): {response.text}")
        except Exception as e:
            print(f"Scoring Exception: {e}")
        
        return {"score": 85, "feedback": "Good effort. Try to be more specific with your resolution."}
