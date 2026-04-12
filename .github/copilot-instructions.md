# Project Guidelines

## Tech Stack

- **Frontend**: React, TypeScript, Vite
- **UI**: shadcn/ui primitives (customized) + Tailwind CSS
- **Routing**: React Router v7
- **Data layer**: strata-data-sync + RxJS (Subjects/Observables)
- **Backend**: Cloudflare Workers + Pages
- **Package manager**: npm

## Project Structure

```
src/
├── app/              # App shell (App.tsx, router.tsx, guards/)
├── ui/               # shadcn/ui primitives — themed, owned by us
├── components/       # Shared custom components (compose ui/ primitives)
├── pages/            # Route pages, each in its own folder
│   └── <page>/       # Page + skeleton + widgets/ + components/
├── templates/        # Page-level layout templates (AuthTemplate, DefaultTemplate)
├── providers/        # React context providers
├── hooks/            # Shared hooks (use sparingly, parallel to providers)
├── lib/              # Utilities (cn, formatters, etc.)
└── services/         # Non-UI business logic (pure .ts, no React)
    ├── entities/     # Entity definitions / models
    ├── utils/        # Service-level utilities (device ID, etc.)
    └── core/         # Domain services (TransactionService, etc.)
functions/            # Cloudflare Workers backend
```

## Path Aliases

Use `@/*` mapped to `src/*` for all imports:
```ts
import { Button } from "@/ui/button"
import { Currency } from "@/components/Currency"
import { TransactionService } from "@/services/core/TransactionService"
```

## Conventions

- Use functional React components only
- Prefer named exports over default exports
- Keep `services/` free of any React or UI code — pure TypeScript only
- `ui/` contains shadcn primitives that we customize for theming — treat them as owned code
- `components/` contains app-specific shared components that compose `ui/` primitives
- Page-specific components live inside `pages/<page>/components/`
- Page-specific widgets live inside `pages/<page>/widgets/`
- Templates define page-level layout shells (auth vs default)

## Testing

- **Runner**: Vitest
- Test files live in `test/` (parallel to `src/`), mirroring `src/` structure
- Example: `src/services/core/TransactionService.ts` → `test/services/core/TransactionService.test.ts`
- No test files inside `src/`
