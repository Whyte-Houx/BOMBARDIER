FROM node:20.12.2-alpine AS build
WORKDIR /app

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
RUN npm run build && npm prune --omit=dev

FROM node:20.18.3-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4050

# Copy built artifacts
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./

USER node
EXPOSE 4050
CMD ["node", "dist/server.js"]