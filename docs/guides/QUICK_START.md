# 🚀 Quick Start Guide

Get Bombardier up and running in 5 minutes!

---

## Prerequisites

Before you begin, ensure you have:

- ✅ Node.js 20.x or higher
- ✅ Docker Desktop installed and running
- ✅ Python 3.11+ (for ML service)
- ✅ 8GB RAM minimum

---

## Step 1: Clone and Setup (1 minute)

```bash
# Clone the repository
git clone <repo-url>
cd app-bombardier-version

# Copy environment configuration
cp .env.example .env
```

**Note**: Edit `.env` and add your API keys (OpenAI, platform credentials, etc.)

---

## Step 2: Start Infrastructure (2 minutes)

```bash
# Start MongoDB and Redis
docker-compose up -d mongodb redis

# Wait for services to be healthy (~10 seconds)
sleep 10

# Verify services are running
docker ps
```

You should see:

- `bombardier-mongodb` - healthy
- `bombardier-redis` - healthy

---

## Step 3: Start API Server (1 minute)

```bash
# Start the API server
docker-compose up -d api

# Verify API is running
curl http://localhost:4050/health
```

Expected response: `{"status":"ok"}`

---

## Step 4: Start Dashboard (1 minute)

```bash
# Option A: Using Docker
docker-compose up -d dashboard

# Option B: Development mode
cd frontend/dashboard
npm install
npm run dev
```

---

## Step 5: Access the Application

Open your browser to:

- **Dashboard**: <http://localhost:3000>
- **API**: <http://localhost:4050>
- **API Docs**: <http://localhost:4050/docs> (coming soon)

---

## 🎯 Quick Test

```bash
# Run the test suite to verify everything works
npm test

# Expected result: 41/41 tests passing ✅
```

---

## 🎮 Your First Campaign

1. **Register**: Go to <http://localhost:3000> and create an account
2. **Login**: Use your credentials to log in
3. **Create Campaign**: Click "New Campaign" and fill in the details
4. **Start Campaign**: Click "Start" to begin acquisition

---

## 🚨 Troubleshooting

### Docker not running?

```bash
# Restart Docker Desktop
killall Docker && open -a Docker
sleep 30
```

### Port already in use?

```bash
# Check what's using port 4050
lsof -i :4050

# Stop it or change the port in .env
```

### Tests failing?

```bash
# Make sure infrastructure is running
docker ps

# Restart services
docker-compose restart api redis mongodb
```

---

## 📚 Next Steps

- Read the [User Guide](./USER_GUIDE.md) for detailed features
- Check the [API Documentation](../api/README.md)
- Review the [Testing Guide](../testing/TESTING.md)

---

**🎉 Congratulations!** You're now running Bombardier!

For more help, see the [Troubleshooting Guide](./TROUBLESHOOTING.md)
