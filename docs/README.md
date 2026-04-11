# Roadmap

This roadmap reflects the current state of the project based on the code in the repository.

## Done

- Generated skill trees in Supabase
- Display the skill tree in the frontend
- Render backend-driven node XP in the skill tree
- Guided plan creation with saved-plan listing, activation, and deletion
- Quiz generation for selected skill tree nodes
- Standalone quiz generation from a freeform prompt
- Quiz hint and explanation options, with hard mode disabling help
- Quiz submission and answer validation
- Code-based quiz questions using Piston-backed execution
- Supabase authentication flow
- Protected backend routes
- XP recording in `quiz_done`
- Supabase event recording for XP and quiz completion
- User stats endpoint and dashboard XP charts backed by event data
- AI-based branch advancement for nodes that reach the XP threshold
- Dashboard XP charts linked to the authenticated user
- Typing practice page with live WPM/EPM charting

## In Progress

- Progress and analytics beyond XP and quiz completion
- Resume-session behavior across saved trees and quiz work
- Dashboard and learning flow polish
- Refining AI-generated progression quality and pacing

## Not Done Yet

- Dedicated topic explanation feature
- Study plan generator
- Fully built standalone coding/test page
- Broader deployment and production hardening

## Notes

- The project now has persistence for quizzes, skill trees, XP events, and node progression metadata.
- Some user-facing dashboard areas are still scaffolded or use placeholder data outside the XP and quiz-completion flow.
- The tracked frontend app directory is `frontend/CodeMaxxer`.
