# Install dependencies and build (if needed)
FROM node:20-alpine

WORKDIR /app

# Install Python and build tools for mediasoup
RUN apk add --no-cache python3 py3-pip make g++ linux-headers

# Create non-root user and group before chown
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install dependencies only (use package-lock.json if present)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy app source
COPY . .

# Create uploads directory and set permissions
RUN mkdir -p /app/uploads && chown appuser:appgroup /app/uploads

# Expose the backend port
EXPOSE 5000

# Use a non-root user for security
USER appuser

# Start the server
CMD ["node", "server.js"]