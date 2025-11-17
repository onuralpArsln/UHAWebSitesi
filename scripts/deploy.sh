#!/bin/bash

# Deployment script for UHA News Server
# Kills processes on port 3000, checks CSS files, and starts the server

set -e  # Exit on error

PORT=3000
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Starting deployment process..."

# Step 1: Kill processes using port 3000
echo "📌 Checking for processes on port $PORT..."
if lsof -ti:$PORT > /dev/null 2>&1; then
    echo "⚠️  Found processes using port $PORT, killing them..."
    lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
    sleep 2
    echo "✅ Port $PORT is now free"
else
    echo "✅ Port $PORT is already free"
fi

# Step 2: Check CSS files
echo "🎨 Checking CSS files..."
CSS_DIR="$PROJECT_DIR/public/css"
REQUIRED_CSS=("variables.css" "main.css" "widgets.css")
MISSING_CSS=()

for css_file in "${REQUIRED_CSS[@]}"; do
    if [ ! -f "$CSS_DIR/$css_file" ]; then
        MISSING_CSS+=("$css_file")
        echo "❌ Missing CSS file: $css_file"
    else
        echo "✅ Found CSS file: $css_file"
    fi
done

if [ ${#MISSING_CSS[@]} -gt 0 ]; then
    echo "⚠️  Warning: ${#MISSING_CSS[@]} CSS file(s) are missing:"
    for file in "${MISSING_CSS[@]}"; do
        echo "   - $file"
    done
    echo "   The server will start, but styles may not load correctly."
else
    echo "✅ All required CSS files are present"
fi

# Step 3: Check if .env file exists
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "⚠️  Warning: .env file not found"
    if [ -f "$PROJECT_DIR/env.example" ]; then
        echo "   You can copy env.example to .env and configure it"
    fi
fi

# Step 4: Start the server
echo "🚀 Starting server on port $PORT..."
cd "$PROJECT_DIR"
NODE_ENV=${NODE_ENV:-production} node server/index.js

