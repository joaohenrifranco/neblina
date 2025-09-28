# Multi-stage build for Neblina
FROM golang:1.24-alpine AS go-builder

# Install build dependencies
RUN apk add --no-cache git

# Set working directory for Go build
WORKDIR /app/go

# Copy Go module files
COPY go/go.mod go/go.sum ./

# Download Go dependencies
RUN go mod download

# Copy Go source code
COPY go/ ./

# Build WebAssembly module
RUN GOOS=js GOARCH=wasm go build -o rclone.wasm .

# Copy WASM runtime (check common locations)
RUN if [ -f "$(go env GOROOT)/misc/wasm/wasm_exec.js" ]; then \
        cp "$(go env GOROOT)/misc/wasm/wasm_exec.js" ./; \
    elif [ -f "/usr/local/go/misc/wasm/wasm_exec.js" ]; then \
        cp "/usr/local/go/misc/wasm/wasm_exec.js" ./; \
    else \
        find /usr/local/go -name "wasm_exec.js" -exec cp {} ./ \; || \
        (echo "wasm_exec.js not found" && exit 1); \
    fi

# Node.js build stage
FROM node:20-alpine AS node-builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Copy WASM files from Go builder
COPY --from=go-builder /app/go/rclone.wasm ./public/
COPY --from=go-builder /app/go/wasm_exec.js ./public/

# Build the application
RUN npm run build:vue

# Production stage with nginx
FROM nginx:alpine

# Copy custom nginx config
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript application/wasm;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Handle client-side routing
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|wasm)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Copy built application
COPY --from=node-builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]