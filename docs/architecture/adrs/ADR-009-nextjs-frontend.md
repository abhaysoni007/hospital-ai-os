# ADR-009: Next.js Frontend Framework

> **Status:** Accepted  
> **Date:** 2026-08-20  
> **Decision Makers:** Architecture Phase 3

## Context

Hospital AI OS needs a React-based frontend with server-side rendering capability, TypeScript support, and file-based routing for a clinical workspace application with 19+ routes.

## Decision

**Next.js 14 (App Router)** with TypeScript, React Server Components, and TanStack Query for server state management.

## Alternatives Considered

| Alternative             | Pros                            | Cons                                                         | Reason Rejected                                                  |
| :---------------------- | :------------------------------ | :----------------------------------------------------------- | :--------------------------------------------------------------- |
| **Vite + React Router** | Lighter; faster build; simpler  | No SSR; manual routing configuration; no built-in API routes | SSR provides faster initial page loads for clinical workstations |
| **Remix**               | Good data loading patterns; SSR | Smaller community; less mature ecosystem                     | Next.js has broader ecosystem and community support              |

## Consequences

- File-based routing reduces routing boilerplate
- SSR improves initial load performance for clinical workstations
- React Server Components reduce client-side JavaScript
- App Router provides layouts for consistent clinical workspace shell
- TanStack Query manages server state with caching and background refetch
- Zustand for minimal client state (auth, UI)
