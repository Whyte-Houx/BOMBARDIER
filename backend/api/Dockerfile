FROM node:20.12.2-alpine AS build
WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Optimize layer caching: Install dependencies first
COPY package.json package-lock.json* ./
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-factor 2 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci --include=dev || npm install --include=dev

# Copy source code after dependencies are installed
COPY tsconfig.json ./
COPY src ./src

# Build application
RUN npm run build

# Production stage - same base to ensure binary compatibility
FROM node:20.12.2-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4050

# Install build dependencies for native modules (argon2)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only (will rebuild argon2 natively)
RUN npm ci --omit=dev || npm install --omit=dev

# Copy built artifacts
COPY --from=build /app/dist ./dist

# Clean up build dependencies to reduce image size
RUN apk del python3 make g++ && rm -rf /var/cache/apk/*

USER node
EXPOSE 4050
CMD ["node", "dist/server.js"]