#!/bin/bash

set -e

echo "🔧 Building rclone WASM module..."

if ! command -v go &> /dev/null; then
    echo "❌ Go is not installed. Please install Go first."
    exit 1
fi

GO_VERSION=$(go version | cut -d' ' -f3)
echo "🐹 Using Go version: ${GO_VERSION}"

echo "📦 Building WASM module..."
GOOS=js GOARCH=wasm go build -o ../public/rclone.wasm .

if [ ! -f "../public/wasm_exec.js" ]; then
    echo "📋 Copying Go WASM runtime..."
    cp "$(go env GOROOT)/misc/wasm/wasm_exec.js" ../public/
fi

if [ -f "../public/rclone.wasm" ] && [ -f "../public/wasm_exec.js" ]; then
    echo "✅ WASM module built successfully!"
    echo "   - rclone.wasm: $(ls -lh ../public/rclone.wasm | awk '{print $5}')"
    echo "   - wasm_exec.js: $(ls -lh ../public/wasm_exec.js | awk '{print $5}')"
else
    echo "❌ Build failed - missing output files"
    exit 1
fi

echo "🚀 Ready"
