# CodeMaxxer

CodeMaxxer is the RaptorHacks project: a coding-focused learning platform with a React frontend, a FastAPI backend, Supabase authentication and storage, and Groq-powered AI features.

## Current State

Implemented:

- Landing page and login flow
- Supabase authentication with OAuth callback handling
- Protected dashboard routes
- Skill tree generation with AI
- Skill tree rendering in the frontend
- Saved skill trees loaded from the backend
- Node-linked quiz generation
- Quiz answer validation and submission
- Code-based quiz questions using Piston-backed execution
- Groq-backed chat and AI route support

Still in progress:

- Skill completion and progress-tracking flows
- Resume-session behavior and overall learning flow polish
- Standalone coding page beyond placeholder scaffolding
- Study-plan and topic-explanation style features

## Stack

- Frontend: React + Vite
- Backend: FastAPI + Uvicorn
- Auth and storage: Supabase
- AI: Groq
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
