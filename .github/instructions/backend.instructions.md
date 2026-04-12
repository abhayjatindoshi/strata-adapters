---
description: "Use when creating or editing Cloudflare Workers backend code. Covers request handling and API patterns."
applyTo: "functions/**"
---

# Backend Guidelines (Cloudflare Workers)

- Use the Workers API (`Request`, `Response`, `env` bindings)
- Keep handlers small and focused — one responsibility per route
- Return proper HTTP status codes and JSON responses
- Validate incoming request data at the boundary
- Use environment bindings for secrets and KV/D1 access — never hardcode
