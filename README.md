# CodeMaxxer

CodeMaxxer is the RaptorHacks project: a coding-focused learning platform with a React frontend, a FastAPI backend, Supabase authentication and storage, Groq-powered AI features, and Piston-backed code execution.

## Current State

Implemented:

- Landing page and login flow
- Supabase authentication with OAuth callback handling
- Protected dashboard routes
- Skill tree generation with AI
- Saved skill trees loaded from the backend
- Skill tree rendering in the frontend with backend-driven XP values
- Node-linked quiz generation
- Standalone quiz generation from a language + topic prompt
- Quiz answer validation and submission
- Code-based quiz questions using Piston-backed execution
- Groq-backed chat and AI route support
- Quiz XP recording through Supabase analytics tables
- Node progression metadata stored in the skill tree
- AI-generated branch advancement when node XP reaches unlock thresholds
- Frontend dashboard XP charts linked to the authenticated user

Still in progress:

- Dashboard analytics beyond XP
- Standalone coding page beyond placeholder scaffolding
- Study-plan and topic-explanation style features
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

## Notes

- The frontend is still planned for Vercel deployment.
- The backend and product flows are still evolving.
- This repo reflects active development, not a polished production release.
