# Python ML Service - Target Acquisition & Engagement AI

# Per dev_docs/technical_specs/architecture.md

## Overview

This Python microservice provides AI/ML capabilities for the Bombardier system:

- Bot detection using ML models
- Sentiment analysis using NLP
- Interest extraction using topic modeling
- Profile scoring and ranking
- Message personalization recommendations

## Tech Stack

- FastAPI for REST API
- scikit-learn for ML models
- spaCy for NLP
- sentence-transformers for embeddings
- Redis for caching
- Optional: TensorFlow/PyTorch for deep learning models

## API Endpoints

- POST /analyze/profile - Full profile analysis
- POST /detect/bot - Bot detection scoring
- POST /analyze/sentiment - Sentiment analysis
- POST /extract/interests - Interest extraction
- POST /generate/message-context - Message personalization context
- GET /health - Health check

## Setup

```bash
pip install -r requirements.txt
python -m spacy download en_core_web_md
uvicorn src.main:app --host 0.0.0.0 --port 5000
```
