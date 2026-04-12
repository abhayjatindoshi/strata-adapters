---
description: "Use when creating or editing React components, pages, or UI code. Covers component patterns, shadcn usage, and Tailwind conventions."
applyTo: "**/*.tsx"
---

# React Component Guidelines

- Functional components only, no class components
- Prefer named exports: `export function MyComponent()` over `export default`
- Use `cn()` from `lib/utils` for conditional Tailwind classes
- Use `@/*` path alias for all imports — never use relative paths like `../../../`
- Import UI primitives from `@/ui/` (e.g., `import { Button } from "@/ui/button"`)
- Import shared components from `@/components/`
- Co-locate page-specific components in `pages/<page>/components/`
- Co-locate page-specific widgets in `pages/<page>/widgets/`
- Every page should have a skeleton component for loading states
- Wrap pages in the appropriate template (AuthTemplate or DefaultTemplate)
