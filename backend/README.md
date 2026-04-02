# Backend

This is the FastAPI backend for CodeMaxxer, our RaptorHacks project.

## What It Handles

- Groq-backed chat requests
- Supabase token verification
- Protected API routes
- Basic rate limiting and auth helpers

## Current Endpoints

- `GET /`
- `POST /chat`
- `GET /api/v1/private/test/`

## Run Locally

```bash
pip install -r requirements.txt
fastapi dev src/main.py
```

## Notes

- This backend is still in active hackathon development.
- The frontend is being deployed on Vercel.
