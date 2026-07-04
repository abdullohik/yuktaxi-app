# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy all source files FIRST (including prisma schema)
COPY . .

# Install bun
RUN npm install -g bun

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Generate Prisma client (schema is now available)
RUN bun run prisma generate

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
COPY --from=builder /app/prisma ./prisma

# Install only production dependencies
RUN bun install --prod --frozen-lockfile

# Expose port
EXPOSE 3000

# Start the app
CMD ["bun", "run", "start"]
