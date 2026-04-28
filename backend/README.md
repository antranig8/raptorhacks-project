# Backend

This is the FastAPI backend for CodeMaxxer, the RaptorHacks project.

## What It Handles

- Public and protected API routes
- Supabase-backed authentication and token verification
- Basic request throttling
- Groq-backed AI features
- Skill tree and quiz generation flows
- AI-generated Learn lessons for skill-tree nodes, with Supabase caching
- Saved skill tree creation, listing, activation, updates, and deletion
- Code execution for coding quiz validation through Piston
- Quiz XP and completion analytics written to Supabase
- User stats reads from Supabase event rows
- AI-driven skill-tree branch advancement tied to node XP

## Current API Areas

- `GET /`
- `GET /api/v1/public/...`
- `GET|POST|PATCH|DELETE /api/v1/private/...`

Current private routes include:

- `POST /api/v1/private/ai/chat`
- `POST /api/v1/private/ai/skill-tree/generate`
- `GET|POST /api/v1/private/skill-trees`
- `GET|PATCH|DELETE /api/v1/private/skill-trees/{skill_tree_id}`
- `POST /api/v1/private/skill-trees/{skill_tree_id}/learn`
- `POST /api/v1/private/quiz/by-node`
- `POST /api/v1/private/quiz/generate`
- `POST /api/v1/private/quiz/hint`
- `POST /api/v1/private/quiz/submit-answer`
- `POST /api/v1/private/quiz/submit`
- `GET /api/v1/private/user_stats/`
- protected test/private endpoints, including `GET /api/v1/private/test/` and `GET /api/v1/private/test_code/`

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

Run the backend tests from the `backend/` directory:

```bash
pytest
```

`pytest` now resolves the local `src` package through `backend/pytest.ini`, so it can be run directly from the backend folder without manually setting `PYTHONPATH`.

## Environment Variables

The backend expects environment variables for:

- `SUPABASE_URL`
- `SUPABASE_KEY`
- `GROQ_API_KEY`
- `PISTON_API_KEY`

Optional profiling variables:

- `PROFILING_ENABLED`
- `PROFILING_ALL`

## Notes

- CORS is currently configured for local frontend development hosts and the Vercel deployment URLs in `src/main.py`.
- Quiz submission now awards XP, records it in `quiz_done`, and can unlock AI-generated child branches on the saved skill tree.
- Learn lessons are generated once per user/tree/node/version by default and can be regenerated from the frontend.
- User stats currently reads from the `events` table with ranges such as `24h`, `7d`, or `1w`.
- The backend is still in active development and the route surface may continue to change.
