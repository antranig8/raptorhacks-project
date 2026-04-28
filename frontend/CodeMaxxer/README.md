# CodeMaxxer Frontend

This is the React + Vite frontend for CodeMaxxer.

Current app areas:

- Landing page and login flow
- Supabase email/password, password reset, and OAuth sign-in
- Protected dashboard routes
- Guided plan creation and saved-plan management
- D3 skill tree rendering with backend-driven XP values
- AI-generated Learn lesson modal for individual skill-tree nodes
- Node-linked quizzes and standalone generated quizzes
- Quiz hints, explanations, hard mode, per-question validation, and final submission
- Dashboard XP charts backed by the backend user-stats API
- Typing practice with live WPM/EPM charting

## Run Locally

```bash
npm install
npm run dev
```

Other scripts:

- `npm run build`
- `npm run lint`
- `npm run preview`

## Environment Variables

The frontend expects:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUB_KEY`
- `VITE_API_URL`

`VITE_API_URL` can point either to the backend root, such as `http://127.0.0.1:8000`, or to `/api/v1/private`; quiz and skill-tree API helpers normalize both forms.

## Notes

- The app uses Vite aliases from `vite.config.js`, including `@`, `@dashboard`, `@d_general`, `@d_study`, and `@utils`.
- `vercel.json` rewrites all routes to `index.html` for client-side routing.
- Mock quiz and skill-tree data still exists for fallback/local UI behavior, but the main authenticated flows use the backend.
- Learn lessons and node-linked quizzes are requested from selected skill-tree nodes and can be regenerated from the UI.
