#!/bin/bash

# Quick Test Runner
# Run this script to execute tests with proper infrastructure

set -e

echo "🧪 Bombardier Test Runner"
echo "========================="
echo ""

# Function to check if a service is running
check_service() {
    local port=$1
    local name=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "✅ $name is running on port $port"
        return 0
    else
        echo "❌ $name is NOT running on port $port"
        return 1
    fi
}

# Check what we can run
echo "Checking available tests..."
echo ""

# Always available
echo "✅ Unit Tests (no infrastructure needed)"
echo "✅ Contract Tests (no infrastructure needed)"
echo "✅ Worker Logic Tests (no infrastructure needed)"
echo ""

# Check infrastructure
REDIS_OK=false
API_OK=false

if check_service 6379 "Redis"; then
    REDIS_OK=true
fi

if check_service 4050 "API Server"; then
    API_OK=true
fi

echo ""

# Determine what to run
if [ "$1" == "all" ]; then
    if [ "$REDIS_OK" = true ] && [ "$API_OK" = true ]; then
        echo "🚀 Running ALL tests (infrastructure is ready)"
        npm test
    else
        echo "⚠️  Cannot run all tests - infrastructure not ready"
        echo ""
        echo "Missing services:"
        [ "$REDIS_OK" = false ] && echo "  - Redis (port 6379)"
        [ "$API_OK" = false ] && echo "  - API Server (port 4050)"
        echo ""
        echo "Run './setup-test-infrastructure.sh' to start services"
        exit 1
    fi
elif [ "$1" == "unit" ]; then
    echo "🚀 Running Unit Tests"
    npm run test:unit
elif [ "$1" == "integration" ]; then
    if [ "$REDIS_OK" = true ] && [ "$API_OK" = true ]; then
        echo "🚀 Running Integration Tests"
        npm run test:integration
    else
        echo "⚠️  Cannot run integration tests - infrastructure not ready"
        exit 1
    fi
elif [ "$1" == "coverage" ]; then
    if [ "$REDIS_OK" = true ] && [ "$API_OK" = true ]; then
        echo "🚀 Running Tests with Coverage"
        npm run test:coverage
        echo ""
        echo "📊 Opening coverage report..."
        open coverage/index.html 2>/dev/null || echo "Coverage report: coverage/index.html"
    else
        echo "⚠️  Cannot generate full coverage - infrastructure not ready"
        echo "Running unit tests only..."
        npm run test:unit
    fi
else
    echo "Usage: $0 [all|unit|integration|coverage]"
    echo ""
    echo "Options:"
    echo "  all          - Run all tests (requires infrastructure)"
    echo "  unit         - Run unit tests only (no infrastructure needed)"
    echo "  integration  - Run integration tests (requires infrastructure)"
    echo "  coverage     - Run with coverage report (requires infrastructure)"
    echo ""
    echo "Examples:"
    echo "  $0 unit       # Quick unit tests"
    echo "  $0 all        # Full test suite"
    echo "  $0 coverage   # Generate coverage report"
    echo ""
    echo "Current infrastructure status:"
    echo "  Redis (6379):     $([ "$REDIS_OK" = true ] && echo "✅ Running" || echo "❌ Not running")"
    echo "  API (4050):       $([ "$API_OK" = true ] && echo "✅ Running" || echo "❌ Not running")"
    echo ""
    echo "To start infrastructure: ./setup-test-infrastructure.sh"
fi
