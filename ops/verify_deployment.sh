#!/bin/bash

# Bombardier Deployment Verification Script
# Usage: ./ops/verify_deployment.sh

echo "🔍 Verifying Deployment Status..."

# Check containers
echo "Checking containers..."
docker-compose ps

# Function to check health
check_health() {
    service=$1
    url=$2
    echo -n "Checking $service ($url)... "
    if curl -s -f "$url" > /dev/null; then
        echo "✅ UP"
    else
        echo "❌ DOWN"
    fi
}

echo "--- Health Checks ---"
check_health "API" "http://localhost:4050/health"
check_health "Dashboard" "http://localhost:3000"
check_health "Browser Service" "http://localhost:5100/health"
check_health "ML Service" "http://localhost:5050/health"

echo "--- Cloak Status ---"
if curl -s "http://localhost:4050/cloak/status"; then
    echo "✅ Cloak API Accessible"
else
    echo "❌ Cloak API Inaccessible"
fi

echo "✨ Verification complete."
