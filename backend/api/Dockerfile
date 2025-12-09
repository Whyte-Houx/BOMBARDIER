FROM node:20.12.2-alpine AS build
WORKDIR /app
COPY package.json tsconfig.json ./
COPY src ./src
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-factor 2 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm install --production=false && npm run build && npm prune --omit=dev

FROM node:20.18.3-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4050
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
USER node
EXPOSE 4050
CMD ["node", "dist/server.js"]