# Backend

This is the FastAPI backend for CodeMaxxer, the RaptorHacks project.

## What It Handles

- Public and protected API routes
- Supabase-backed authentication and token verification
- Basic request throttling
- Groq-backed AI features
- Skill tree and quiz generation flows
- Code execution for coding quiz validation through Piston
- Quiz XP analytics written to Supabase
- AI-driven skill-tree branch advancement tied to node XP

## Current API Areas

- `GET /`
- `GET /api/v1/public/...`
- `GET|POST|PATCH|DELETE /api/v1/private/...`

Current private routes include:

- chat routes
- quiz generation and submission
- skill tree endpoints
- skill tree updates and deletion
- protected test/private endpoints

## Tech Notes

- Framework: FastAPI
- Server: Uvicorn
- Validation: Pydantic
- Auth and storage: Supabase
- AI provider: Groq - Qwen
- HTTP client: `httpx`
- JWT verification: `PyJWT`
- Code execution: `aiopyston`

## Run Locally

```bash
pip install -r requirements.txt
fastapi dev src/main.py
```

## Environment Variables

The backend expects environment variables for:

- Supabase URL and key
- Groq API key
- Piston API key

## Notes

- CORS is currently configured for local frontend development hosts.
- Quiz submission now awards XP, records it in `quiz_done`, and can unlock AI-generated child branches on the saved skill tree.
- The backend is still in active development and the route surface may continue to change.
