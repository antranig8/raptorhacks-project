# CodeMaxxer

CodeMaxxer is a coding-focused learning platform with a React frontend, a FastAPI backend, Supabase authentication and storage, Groq-powered AI features, and Piston-backed code execution.

## Recognition

Winner of the UI/UX Track and Generative AI Track at RaptorHacks.

## Current State

Implemented:

- Landing page and login flow
- Supabase authentication with OAuth callback handling
- Protected dashboard routes
- Skill tree generation with AI
- Guided plan creation with saved-plan loading, activation, and deletion
- Saved skill trees loaded from the backend
- Skill tree rendering in the frontend with backend-driven XP values
- AI-generated Learn lessons for individual skill-tree nodes, cached in Supabase
- Node-linked quiz generation
- Standalone quiz generation from a language + topic prompt
- Quiz hint and explanation options, with hard mode disabling help
- Quiz answer validation and submission
- Code-based quiz questions using Piston-backed execution
- Groq-backed chat and AI route support
- Quiz XP recording through Supabase analytics tables
- User stats API backed by Supabase event rows
- Node progression metadata stored in the skill tree
- AI-generated branch advancement when node XP reaches unlock thresholds
- Frontend dashboard XP charts linked to the authenticated user
- Typing practice with live WPM/EPM charting

Still in progress:

- Dashboard analytics beyond XP and quiz-completion summaries
- Standalone coding/test page beyond placeholder scaffolding
- Plan authoring and saved-plan workflows
- Production hardening and deployment polish

## Stack

- Frontend: React + Vite
- Backend: FastAPI + Uvicorn
- Auth and storage: Supabase
- AI: Groq - Qwen
- Code execution: Piston
- Deployment: Vercel

## Project Structure

```text
raptorhacks-project/
  frontend/CodeMaxxer/
  backend/
  docs/
```

## Documentation

- Project roadmap: [docs/README.md](docs/README.md)
- Backend notes: [backend/README.md](backend/README.md)
- Frontend notes: [frontend/CodeMaxxer/README.md](frontend/CodeMaxxer/README.md)

## Notes

- The frontend includes Vercel SPA rewrite config and expects `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUB_KEY`, and `VITE_API_URL`.
- The backend expects `SUPABASE_URL`, `SUPABASE_KEY`, `GROQ_API_KEY`, and `PISTON_API_KEY`.
- The backend and product flows are still evolving.
- This repo reflects active development, not a polished production release.
