FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application code
COPY server.js ./
COPY services/ ./services/
COPY data/ ./data/

EXPOSE 3001

CMD ["node", "server.js"]
