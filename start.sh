#!/usr/bin/env bash
# ==============================================================================
# New-HRMS Ubuntu / Linux Launcher
# Starts both Backend (FastAPI) and Frontend (Nitro Preview) with automatic venv
# ==============================================================================

set -e

# Change directory to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

VENV_DIR="$SCRIPT_DIR/backend/venv"

# 1. Auto-create venv if it doesn't exist
if [ ! -d "$VENV_DIR" ]; then
    echo "====================================================="
    echo " [Auto-Venv] backend/venv not found."
    echo " Creating Python virtual environment..."
    echo "====================================================="
    python3 -m venv "$VENV_DIR"
    "$VENV_DIR/bin/pip" install --upgrade pip
    if [ -f "$SCRIPT_DIR/backend/requirements.txt" ]; then
        echo " Installing backend dependencies..."
        "$VENV_DIR/bin/pip" install -r "$SCRIPT_DIR/backend/requirements.txt"
    fi
fi

# 2. Check frontend dependencies
if [ ! -d "$SCRIPT_DIR/Frontend/node_modules" ]; then
    echo "====================================================="
    echo " Frontend node_modules not found. Running npm install..."
    echo "====================================================="
    (cd "$SCRIPT_DIR/Frontend" && npm install)
fi

# 3. Launch start.py using virtual environment python
echo "====================================================="
echo " Starting New-HRMS Fullstack Launcher on Ubuntu..."
echo "====================================================="
exec "$VENV_DIR/bin/python" "$SCRIPT_DIR/start.py" "$@"
