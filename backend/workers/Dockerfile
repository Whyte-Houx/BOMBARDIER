# Workers Dockerfile
# Target Acquisition & Engagement AI - Worker Services

FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-factor 2 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm install

# Copy source
COPY src/ ./src/
COPY tsconfig.json ./

# Default command (overridden by docker-compose)
CMD ["npm", "run", "start:acquisition"]
