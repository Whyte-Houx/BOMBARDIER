#!/bin/bash

# Bombardier Setup Script
# Usage: ./ops/setup.sh

set -e

echo "🚀 Starting Bombardier Setup..."

# Check requirements
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not in PATH."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "⚠️ npm is not in PATH. Skipping local dependency install (Docker build will handle it)."
else
    echo "📦 Installing local dependencies for development..."
    # Install dependencies for all services
    for dir in backend/api backend/workers backend/browser-service backend/services/* frontend/dashboard; do
        if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
            echo "   Installing deps in $dir..."
            (cd "$dir" && npm install --silent)
        fi
    done
fi

echo "🐳 Building Docker images..."
docker-compose build

echo "✨ Setup complete!"
echo "Run 'docker-compose up -d' to start the system."
