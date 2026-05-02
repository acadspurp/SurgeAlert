# Environment Setup (Team)

1. Copy template:
   - `cp .env.example .env`
2. Fill real secrets in `.env`.
3. Run apps:
   - Backend reads `.env` automatically via `spring.config.import`.
   - Frontend reads `VITE_*` keys from repo-root `.env` via Vite `envDir`.
   - EdgeSystem reads repo-root `.env` via `config/settings.py`.

## Important

- Never commit `.env`.
- Keep `.env.example` updated when new variables are added.
- For Oracle/Cloudflare production deploys, set the same keys as platform environment variables instead of uploading `.env`.
