# Roadmap

This roadmap reflects the current state of the project based on the code in the repository.

## Done

- Generated skill trees in Supabase
- Display the skill tree in the frontend
- Render backend-driven node XP in the skill tree
- Guided plan creation with saved-plan listing, activation, and deletion
- AI-generated Learn lessons for individual skill-tree nodes
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
- Visual Python labs for projectile motion and canvas-style plotting

## In Progress

- Progress and analytics beyond XP and quiz completion
- Resume-session behavior across saved trees and quiz work
- Dashboard and learning flow polish
- Refining AI-generated progression quality and pacing
- Study plan generator

## Not Done Yet

- Fully built standalone coding/test page
- Broader deployment and production hardening

## Notes

- The project now has persistence for quizzes, skill trees, XP events, and node progression metadata.
- Learn lesson content is cached in Supabase so repeated node clicks do not always call the AI provider.
- Some user-facing dashboard areas are still scaffolded or use placeholder data outside the XP and quiz-completion flow.
- The tracked frontend app directory is `frontend/CodeMaxxer`.
