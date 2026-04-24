# ==========================================
# Stage 1: Build the React Frontend
# ==========================================
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend source code
COPY frontend/package*.json ./
RUN npm install

COPY frontend/ .
RUN npm run build

# ==========================================
# Stage 2: Build the FastAPI Backend
# ==========================================
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
# We use the root requirements.txt which points to the dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt psycopg2-binary httpx

# Copy the backend source code
COPY backend/ ./backend/

# Copy the built React app from Stage 1 into the Python container
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose the port Railway expects
EXPOSE 8000

# Start Uvicorn
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
