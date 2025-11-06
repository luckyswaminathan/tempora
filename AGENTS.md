# Repository Guidelines

## Project Structure & Module Organization
- `frontend/` hosts the Next.js app. Place UI screens under `app/`, shared widgets in `components/`, and utility helpers in `lib/`. Static assets live in `public/`.
- `backend/` contains the FastAPI service. Route definitions belong in modules beside `main.py`; group related logic into packages to keep the entrypoint slim.
- Keep configuration files (`eslint.config.mjs`, `tsconfig.json`, `next.config.ts`) in `frontend/` and update them alongside feature work.

## Build, Test, and Development Commands
- Frontend install: `cd frontend && npm install` (run once per environment).
- Frontend dev server: `npm run dev` for hot-reloading at `http://localhost:3000`.
- Frontend production build: `npm run build` then `npm run start` to verify the optimized bundle.
- Lint check: `npm run lint` to catch TypeScript, React, and accessibility issues before sending a review.
- Backend dev server: from repo root run `uvicorn backend.main:app --reload --port 8000` and visit `/health` for a quick smoke test.

## Coding Style & Naming Conventions
- TypeScript/React: follow ESLint guidance; default to 2-space indentation. Name components and files in `components/` with PascalCase, route segments in `app/` with kebab-case directories.
- Styling: prefer Tailwind utility classes; colocate reusable style helpers in `lib/`.
- Python: keep modules PEP 8 compliant with 4-space indents and snake_case functions. Add FastAPI routers per domain for clarity.

## Testing Guidelines
- Frontend: add component or integration tests under `frontend/__tests__/` using your preferred framework; ensure `npm run lint` stays clean until a dedicated test runner is configured.
- Backend: place API tests in `backend/tests/` and exercise endpoints with `pytest` or HTTP clients (e.g., `httpx`). Maintain descriptive test names mirroring the endpoint, such as `test_health_returns_ok`.
- Document any manual verification steps in pull requests when automated coverage is unavailable.

## Commit & Pull Request Guidelines
- Use present-tense, imperative commit subjects (`feat: add dashboard filter`). Current history is terse; adopt descriptive messages to aid reviewers.
- Keep commits scoped to a single concern and include context in the body when behavior changes or migrations are required.
- Pull requests should summarize the change, link tracking issues, list testing evidence (commands run, screenshots for UI), and call out follow-ups or known gaps.
