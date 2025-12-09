# Browser Automation Service Dockerfile
# Uses Playwright with Chromium for browser automation

FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-factor 2 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Environment variables
ENV NODE_ENV=production
ENV PORT=5100
ENV HEADLESS=true
ENV MAX_BROWSERS=5

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5100/health || exit 1

# Expose port
EXPOSE 5100

# Run the service
CMD ["node", "dist/index.js"]
