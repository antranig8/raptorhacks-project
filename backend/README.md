# Backend (FastAPI)

## How to run
```
pip install -r requirements.txt
fastapi dev src/main.py
```

## Environment Variables
GROQ_API_KEY = groq api key for LLM
JWT_SECRET_KEY = secret key for jwt (required)

## Mock Auth (for now)
The backend uses an in-memory (mock) user DB, seeded with a default user:
- username: `test`
- password: `test`

Override via env vars:
- DEV_AUTH_USERNAME
- DEV_AUTH_PASSWORD
- DEV_AUTH_UUID (optional UUID string)
- JWT_ACCESS_TOKEN_EXPIRE_MINUTES (default: 30)

### Get a token
`POST /api/v1/public/token` (form-encoded: `username`, `password`)

### Call a protected route
Send `Authorization: Bearer <token>` to any `/api/v1/private/*` route.

## Overview
This is the FastAPI backend for the RaptorHacks project.  
It handles requests from the frontend, sends prompts to the Groq API, and returns structured JSON skill trees.

## Runs On
http://localhost: TBD

## Current Tech Stack
- FastAPI
- Groq API
- Pydantic
- Python

## Notes
- Define API routes here
- Connect to supabase
