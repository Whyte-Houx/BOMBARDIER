FROM node:20.18.3-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20.18.3-alpine

WORKDIR /app

# Install VPN tools
RUN apk add --no-cache \
    wireguard-tools \
    openvpn \
    iptables \
    resolvconf \
    ip6tables

# Copy built files
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./

# Create directories required by VPN tools
RUN mkdir -p /etc/wireguard /tmp/openvpn

# Note: This container needs NET_ADMIN capability
CMD ["node", "dist/index.js"]
