#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

echo "📦 Installing Node.js dependencies and building React app..."
cd frontend
npm install
npm run build
cd ..

echo "✅ Build complete!"
