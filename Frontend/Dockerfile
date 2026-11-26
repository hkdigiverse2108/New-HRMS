# Use an official Node.js runtime as a parent image
FROM node:20-alpine

WORKDIR /app

# Install build dependencies if needed
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy frontend source code
COPY . .

# Pass build-time environment variable for VITE_API_URL
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Build the frontend application
RUN npm run build

# Expose the frontend port (default 7788)
EXPOSE 7788

# Start Nitro preview server
CMD ["node", "run-preview.mjs"]
