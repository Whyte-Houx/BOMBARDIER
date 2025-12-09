# Python ML Service Dockerfile
# Per dev_docs/technical_specs/architecture.md

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --default-timeout=1000 --no-cache-dir -r requirements.txt

# Download spaCy model
RUN python -m spacy download en_core_web_sm || echo "spaCy model download skipped - will use fallback"

# Copy application code
COPY src/ ./src/
COPY models/ ./models/

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Expose port
EXPOSE 5000

# Run the application
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "5000"]
