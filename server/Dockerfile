FROM node:18-bullseye-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package manifests first for better layer caching
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --only=production || npm install --production

# Copy rest of the server source
COPY . .

# Ensure entrypoint script is executable
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 5000

CMD ["./docker-entrypoint.sh"]
