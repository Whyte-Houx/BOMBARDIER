#!/bin/bash

# Test Infrastructure Setup Script
# This script helps set up the required services for running the full test suite

set -e

echo "🚀 Bombardier Test Infrastructure Setup"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker is running${NC}"
echo ""

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Port $1 is already in use${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Port $1 is available${NC}"
        return 0
    fi
}

# Check required ports
echo "Checking required ports..."
check_port 6379  # Redis
check_port 27017 # MongoDB
check_port 4050  # API
echo ""

# Start Redis
echo "Starting Redis..."
if docker ps | grep -q bombardier-redis; then
    echo -e "${YELLOW}⚠️  Redis container already running${NC}"
else
    docker run -d \
        --name bombardier-redis \
        -p 6379:6379 \
        redis:7-alpine
    echo -e "${GREEN}✅ Redis started on port 6379${NC}"
fi
echo ""

# Start MongoDB
echo "Starting MongoDB..."
if docker ps | grep -q bombardier-mongo; then
    echo -e "${YELLOW}⚠️  MongoDB container already running${NC}"
else
    docker run -d \
        --name bombardier-mongo \
        -p 27017:27017 \
        -e MONGO_INITDB_ROOT_USERNAME=admin \
        -e MONGO_INITDB_ROOT_PASSWORD=password \
        mongo:7
    echo -e "${GREEN}✅ MongoDB started on port 27017${NC}"
fi
echo ""

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 3

# Test Redis connection
if docker exec bombardier-redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis is ready${NC}"
else
    echo -e "${RED}❌ Redis is not responding${NC}"
fi

# Test MongoDB connection
if docker exec bombardier-mongo mongosh --quiet --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ MongoDB is ready${NC}"
else
    echo -e "${YELLOW}⚠️  MongoDB might still be initializing...${NC}"
fi
echo ""

# Display connection info
echo "📋 Service Connection Information"
echo "=================================="
echo "Redis:   redis://localhost:6379"
echo "MongoDB: mongodb://admin:password@localhost:27017"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOF
# Database
MONGODB_URI=mongodb://admin:password@localhost:27017/bombardier?authSource=admin
REDIS_URL=redis://localhost:6379

# API
API_URL=http://localhost:4050
BROWSER_SERVICE_URL=http://localhost:5100
USE_BROWSER_SERVICE=true

# OpenAI (replace with your key)
OPENAI_API_KEY=your-openai-key-here

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production

# Test Environment
NODE_ENV=test
TEST_API_URL=http://localhost:4050
EOF
    echo -e "${GREEN}✅ .env file created${NC}"
else
    echo -e "${YELLOW}⚠️  .env file already exists${NC}"
fi
echo ""

# Display next steps
echo "🎯 Next Steps"
echo "============="
echo "1. Update OPENAI_API_KEY in .env file (if needed for tests)"
echo "2. Start the API server:"
echo "   cd backend/api && npm run dev"
echo ""
echo "3. Run the tests:"
echo "   npm test                    # Run all tests"
echo "   npm run test:integration    # Run integration tests only"
echo "   npm run test:coverage       # Run with coverage report"
echo ""
echo "4. To stop the services:"
echo "   docker stop bombardier-redis bombardier-mongo"
echo "   docker rm bombardier-redis bombardier-mongo"
echo ""
echo -e "${GREEN}✅ Infrastructure setup complete!${NC}"
