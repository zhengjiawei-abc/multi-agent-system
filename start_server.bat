@echo off
setlocal

if not exist .venv (
  python -m venv .venv
)

.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn server:app --host 0.0.0.0 --port 8765
