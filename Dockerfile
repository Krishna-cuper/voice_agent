# ==========================================
# Stage 1: Build the React Frontend
# ==========================================
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ .
RUN npm run build

# ==========================================
# Stage 2: Backend + Whisper
# ==========================================
FROM python:3.10-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    psycopg2-binary \
    httpx \
    faster-whisper \
    openai-whisper-asr-webservice

# Backend code
COPY backend/ ./backend/

# Frontend build
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port
EXPOSE 8000

# Run BOTH Whisper + FastAPI
CMD sh -c "python3 -m whisper_asr.webservice --host 0.0.0.0 --port 9000 & uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"
