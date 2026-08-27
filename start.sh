#!/usr/bin/env bash
set -e
python -m uvicorn app:app --host 0.0.0.0 --port 3015
