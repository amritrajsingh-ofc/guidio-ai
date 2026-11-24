# Guidio AI — Improvement Plan

## Executive Summary

Guidio AI is a well-architected, production-ready full-stack application with excellent engineering practices. The codebase demonstrates:

- **Clean architecture** with clear separation of concerns (routes → controllers → services → AI layer)
- **Robust AI provider management** with automatic failover, cooldowns, and retries
- **Excellent security practices** (server-side secrets, Clerk auth, Helmet, CORS, rate limiting)
- **Good developer experience** (comprehensive docs, typed config, structured logging)
- **Free-tier awareness** with graceful degradation when providers are rate-limited

---

## High-Impact Improvements (Recommended First)

### 1. Add Request/Response Validation Middleware (Backend)

**File:** `guidio-backend/src/middleware/validate-request.js` (new)

Currently validation happens per-controller. A centralized middleware using Zod schemas would reduce duplication and ensure consistency.

```javascript
// Example implementation
import { z } from "zod";
import { sendError } from "../utils/api-response.js";

export function validateRequest(schema, source = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return sendError(res, "Invalid request data", 400, {
        issues: result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`),
      }, "validation");
    }
    req.validatedData = result.data;
    next();
  };
}
```

### 2. Add End-to-End Tests (Frontend + Backend)

**Tool:** Playwright or Cypress

The backend has 68 unit tests but no integration/E2E tests. Add tests for:
- User signup → onboarding → profile → assistant chat flow
- Career guidance generation from profile
- Mock interview completion flow
- Rate limit handling UI

### 3. Add Request ID / Correlation ID

**Files:** `guidio-backend/src/middleware/request-id.js` (new), `guidio-backend/src/utils/logger.js`

Add a unique request ID to every request for debugging:

```javascript
// middleware/request-id.js
import { randomUUID } from "crypto";

export function requestIdMiddleware(req, res, next) {
  const id = req.headers["x-request-id"] || randomUUID();
  req.requestId = id;
  res.setHeader("X-Request-ID", id);
  next();
}
```

Then include in all log entries.

### 4. Implement API Versioning

**File:** `guidio-backend/src/routes/index.js` (new router aggregator)

Currently all routes are mounted at `/api`. Add versioning for future-proofing:

```javascript
// routes/index.js
import { Router } from "express";
import v1Routes from "./v1/index.js";

const router = Router();
router.use("/api/v1", v1Routes);
// Redirect /api/* to /api/v1/* for backward compat
router.use("/api", (req, res, next) => {
  req.url = `/v1${req.url}`;
  v1Routes(req, res, next);
});
export default router;
```

---

## Medium-Impact Improvements

### 5. Add OpenAPI/Swagger Documentation

**Tool:** `zod-to-openapi` + `swagger-ui-express`

Generate docs from Zod schemas automatically. Example for `src/routes/assistant-routes.js`:

```javascript
import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";

const sendMessageSchema = z.object({
  content: z.string().min(1).max(8000),
});

app.post("/conversations/:id/messages", 
  requireAuth,
  validateCreateMessage,
  sendMessage
).openapi({
  summary: "Send a message to the AI assistant",
  tags: ["Assistant"],
  requestBody: { content: { "application/json": { schema: sendMessageSchema } } },
  responses: { 200: { description: "Streaming SSE response" } },
});
```

### 6. Improve Frontend Error Boundaries

**File:** `guidio-frontend/src/components/common/error-boundary.jsx` (new)

Add React error boundaries to catch rendering errors gracefully:

```jsx
import { Component } from "react";

export class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, info) {
    logger.error("react_render_error", { error, componentStack: info.componentStack });
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} resetKeys={this.props.resetKeys} />;
    }
    return this.props.children;
  }
}
```

Wrap page components in `<ErrorBoundary resetKeys={[activeId]}>`.

### 7. Add Frontend Integration Tests

**Tool:** Vitest + React Testing Library

Current frontend has no tests. Add tests for:
- `useAssistant` hook behavior (mocking api-client)
- `useAuth` integration with Clerk
- Form validation in onboarding/profile pages

### 8. Implement Request Deduplication

**File:** `guidio-frontend/src/lib/api-client.js` (enhance `apiRequest`)

Prevent duplicate simultaneous requests (e.g., double-clicking send):

```javascript
const pendingRequests = new Map();

export async function apiRequest(endpoint, options = {}) {
  const key = `${options.method || "GET"}:${endpoint}:${JSON.stringify(options.body || {})}`;
  
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }
  
  const promise = doRequest(endpoint, options).finally(() => {
    pendingRequests.delete(key);
  });
  
  pendingRequests.set(key, promise);
  return promise;
}
```

---

## Low-Impact / Nice-to-Have

### 9. Add Database Query Logging (Development Only)

**File:** `guidio-backend/src/config/prisma.js`

```javascript
if (env.isDevelopment) {
  prisma.$on("query", (e) => {
    logger.debug("prisma_query", { query: e.query, params: e.params, duration: e.duration });
  });
}
```

### 10. Improve TypeScript Coverage

**Files:** `guidio-frontend/tsconfig.json`, `guidio-backend/tsconfig.json`

The project uses JSDoc + `jsconfig.json`. Consider migrating to TypeScript for:
- Better IDE support
- Catch type errors at build time
- Self-documenting code

Can be done incrementally with `allowJs: true`.

### 11. Add Performance Monitoring

**Backend:** `guidio-backend/src/middleware/performance.js`

```javascript
export function performanceMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    if (durationMs > 1000) {
      logger.warn("slow_request", { path: req.path, method: req.method, durationMs });
    }
    // Send to metrics service (e.g., Prometheus, Datadog)
  });
  next();
}
```

### 12. Improve SEO / Meta Tags

**File:** `guidio-frontend/index.html` + page-level meta

Add dynamic meta tags for shared links:
- Open Graph tags for career plans, skill-gap reports
- Twitter cards
- JSON-LD structured data for FAQ pages

### 13. Add Accessibility Audit

**Tool:** `axe-core` in tests

```javascript
// tests/a11y.test.js
import { render } from "@testing-library/react";
import { axe } from "jest-axe";

test("assistant page has no accessibility violations", async () => {
  const { container } = render(<AssistantPage />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### 14. Implement Conversation Search/Filter

**Backend:** Add full-text search index on `AssistantMessage.content`
**Frontend:** Add search box in conversation list sidebar

```javascript
// prisma/schema.prisma - add to AssistantMessage
@@index([content]) // MongoDB text index would be better
```

### 15. Add Conversation Export Feature

**Backend:** `GET /api/assistant/conversations/:id/export`
**Frontend:** "Export" button in conversation menu

Formats: JSON, Markdown, PDF (using `pdf-lib`)

---

## Code Quality Issues Found

### 1. Inconsistent Error Handling Pattern

Some controllers use `try/catch` + `next(error)`, others use `sendError` directly. Standardize.

**Files to review:**
- `src/controllers/assistant-controller.js` ✓ (consistent)
- `src/controllers/career-controller.js` (check)
- `src/controllers/interview-controller.js` (check)

### 2. Magic Numbers

Replace with named constants:

```javascript
// src/services/assistant-service.js
const HISTORY_LIMIT = 10;           // → MOVE TO config
const MIN_PARTIAL_CHARS = 20;       // → MOVE TO config
const STREAM_CONNECT_TIMEOUT_MS = 60_000; // frontend use-assistant.js
```

### 3. Missing JSDoc on Public Functions

Many exported functions lack documentation. Add for:
- All service functions
- All controller functions  
- All AI provider methods

### 4. Frontend: `useAssistant` is Very Large

**File:** `guidio-frontend/src/features/assistant/use-assistant.js` (1,300+ lines)

Consider splitting:
- `useConversations` - list, create, delete
- `useMessages` - load, send, stream handling
- `useAssistant` - compose the above

### 5. Inconsistent Naming

- `sendMessage` vs `createAssistantReply` vs `streamText`
- `conversationId` vs `id` vs `conversation_id` (check API responses)

---

## Security Hardening

### 16. Add Content Security Policy

**File:** `guidio-backend/src/app.js`

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Vite needs inline in dev
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", env.apiBaseUrl], // For SSE
      frameAncestors: ["'none'"],
    },
  },
}));
```

### 17. Add Request Size Limits Per Route

Currently global 100kb. Make stricter for non-streaming routes:

```javascript
// In routes that don't need large bodies
app.use("/api/profile", express.json({ limit: "10kb" }));
app.use("/api/assistant/conversations/:id/messages", express.json({ limit: "100kb" }));
```

### 18. Implement Audit Logging

Log security-relevant events:
- Failed login attempts
- Profile changes
- Conversation deletions
- Admin actions (if any)

---

## Deployment & DevOps

### 19. Add GitHub Actions CI

**File:** `.github/workflows/ci.yml`

```yaml
name: CI
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm', cache-dependency-path: 'guidio-backend/package-lock.json' }
      - run: cd guidio-backend && npm ci && npm run lint && npm test
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm', cache-dependency-path: 'guidio-frontend/package-lock.json' }
      - run: cd guidio-frontend && npm ci && npm run lint && npm run build
```

### 20. Add Dependency Update Automation

**Tool:** Dependabot or Renovate

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/guidio-backend"
    schedule: { interval: "weekly" }
  - package-ecosystem: "npm"
    directory: "/guidio-frontend"
    schedule: { interval: "weekly" }
```

### 21. Add Health Check Endpoint Details

Current `/api/health` is good. Add:
- Memory usage
- Active connections count
- AI provider status details

---

## Priority Matrix

| Priority | Effort | Impact | Items |
|----------|--------|--------|-------|
| **P0 - Do First** | Low | High | 1, 3, 16, 19 |
| **P1 - This Sprint** | Medium | High | 2, 4, 6, 7, 17 |
| **P2 - Next Sprint** | Medium | Medium | 5, 8, 9, 11, 20 |
| **P3 - When Time Permits** | High | Medium | 10, 12, 13, 14, 15 |
| **P4 - Code Quality** | Low | Low | 18, 21 + code quality issues |

---

## Quick Wins (Can Do Today)

1. **Add request ID middleware** - 15 min
2. **Add CSP header** - 10 min  
3. **Extract magic numbers to config** - 20 min
4. **Add JSDoc to service functions** - 30 min
5. **Enable Dependabot** - 5 min
6. **Add `.nvmrc` with Node 22** - 2 min

---

## Architecture Strengths to Preserve

1. **Provider abstraction** - Never import provider SDKs in services ✓
2. **Failover logic** - Handles streaming mid-stream correctly ✓
3. **Structured logging** - No secrets in logs ✓
4. **Graceful shutdown** - Handles Render SIGTERM properly ✓
5. **Zod validation** - At config + request level ✓
6. **Streaming with abort** - Cancels AI on client disconnect ✓
7. **Partial reply saving** - On interruption ✓

---

## Suggested Next Steps

1. **Create GitHub Issues** for P0/P1 items
2. **Set up CI** (GitHub Actions) before merging more features
3. **Add E2E tests** for critical user flows
4. **Consider TypeScript migration** for frontend first (better React support)
5. **Monitor Render metrics** after deployment to identify real bottlenecks

---

*Generated from codebase analysis on 2026-11-25*