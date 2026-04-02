# Backend (FastAPI)

## How to run
```
pip install -r requirements.txt
fastapi dev src/main.py
```

## Environment Variables
GROQ_API_KEY = groq api key for LLM
SUPABASE_URL = project URL
SUPABASE_KEY = project anon or service key for backend Supabase client

### Call a protected route
Send `Authorization: Bearer <supabase access token>` to any `/api/v1/private/*` route.

## Overview
This is the FastAPI backend for the RaptorHacks project.  
It handles requests from the frontend, sends prompts to the Groq API, and returns structured JSON skill trees.

## Runs On
http://localhost: TBD

## Current Tech Stack
- FastAPI
- Groq API
- Pydantic
- Supabase Auth
- Python

## Notes
- Define API routes here
- Connect to supabase
