# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install bun
RUN npm install -g bun

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Generate Prisma client
RUN bun run db:generate

# Build Next.js
RUN bun run build

# Runtime stage
FROM node:18-alpine

WORKDIR /app

# Install bun
RUN npm install -g bun

# Copy built app from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock

# Install only production dependencies
RUN bun install --prod --frozen-lockfile

# Expose port
EXPOSE 3000

# Start the app
CMD ["bun", "run", "start"]
