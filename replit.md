# Malinha Store

A fashion consignment management app ("malinha" = small bag) built in React + Vite with Supabase as the backend.

## Architecture

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui components
- **Backend/Auth/DB**: Supabase (hosted externally — no local server)
- **Routing**: React Router v6
- **State**: TanStack Query (React Query)
- **Forms**: React Hook Form + Zod

## Running the App

```bash
npm run dev
```

Runs on **port 5000**. The workflow "Start application" is configured to start this automatically.

## Key Files

- `src/App.tsx` — Routes and top-level providers
- `src/hooks/useAuth.tsx` — Auth context (Supabase session + role fetching)
- `src/integrations/supabase/client.ts` — Supabase client (URL + anon key)
- `src/lib/api.ts` — Data fetching helpers (malinhas, products, photos)
- `src/lib/types.ts` — Shared TypeScript types
- `vite.config.ts` — Vite config with Supabase credentials injected via `define`

## Roles

- **master** — Full admin access
- **loja** — Store owner; can manage their vendedoras
- **vendedora** — Seller; creates and manages malinhas

## Supabase

- Project: `nrlwfsmquwceathtxjgo`
- Edge Functions: `login-by-email`, `manage-users`
- Storage bucket: `product-photos` (public)
- Auth: email-only login via edge function (no password prompt for users)

## Replit Migration Notes

- Removed `lovable-tagger` dev dependency (Lovable-specific, not needed on Replit)
- Vite configured for Replit: `host: "0.0.0.0"`, `port: 5000`, `allowedHosts: true`
- Supabase URL and anon key hardcoded via Vite `define` to bypass incorrect Replit secrets
- `.env` in `.gitignore` — credentials stay out of version control
