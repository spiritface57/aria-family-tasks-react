# Daylight — Aria Family Tasks (React)

A responsive TypeScript + React / Vite family task planner. It supports parent/child roles, recurring weekly tasks, Done / Need help / Not done responses, progress tracking, Supabase synchronization, and calendar export.

## Start

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` to enable shared family mode with Supabase. Never commit Supabase secret or `service_role` keys.

See the source and `supabase/schema.sql` for the current MVP implementation.
