# AGENTS.md - OmniAI Seller Hub Project Configuration & Agent Guidelines

## 1. Project Overview & Vision
- **Project Name:** OmniAI Seller Hub
- **Description:** SaaS platform for multi-channel e-commerce automation (TikTok Shop, Shopee, Lazada). Integrates automated AI customer service, RAG-powered product catalog querying, social/marketplace trend analysis, viral video script generation, and real-time inventory & financial analytics.
- **Target Audience:** Small and Medium E-commerce Sellers (SMEs), live-streamers, and KOC/KOL multi-channel store owners.
- **Architecture Style:** Modular Monolith following Clean Architecture principles in NestJS.
- **Core Technology Stack:**
  - **Backend:** NestJS (TypeScript, Node.js 20+), Modular Monolith.
  - **Database:** PostgreSQL (with `pgvector` extension for vector embeddings).
  - **ORM:** Prisma ORM.
  - **Cache & Async Queues:** Redis (v7+) & BullMQ.
  - **AI / LLM Orchestration:** LangChain / LlamaIndex, OpenAI API (GPT-4o, text-embedding-3-small), Claude API, and optional self-hosted open-source models (Llama 3).
  - **Real-Time Communication:** WebSockets (Socket.io) and Server-Sent Events (SSE).
  - **Frontend (Target Integration):** Next.js (App Router), Tailwind CSS, Lucide Icons, Recharts.
  - **DevOps:** Docker, Docker Compose, Railway / AWS (ECS, RDS, ElastiCache).

---

## 2. Directory Structure & Architecture Standards

```text
src/
├── common/                         # Cross-cutting concerns & shared utilities
│   ├── constants/                  # System constants, queue names, platform types
│   ├── decorators/                 # Custom param decorators (@CurrentUser, @CurrentTenant)
│   ├── filters/                    # Global exception filters (HttpExceptionFilter, PrismaFilter)
│   ├── guards/                     # Authentication & Authorization (JwtGuard, TenantGuard, RolesGuard)
│   ├── interceptors/               # TransformResponseInterceptor, LoggingInterceptor
│   ├── middleware/                 # Request logger, Webhook raw-body parser
│   ├── pipes/                      # Global ValidationPipe configuration
│   └── utils/                      # Cryptography (AES-256), date helpers, hash utilities
├── config/                         # Environment schema validation (Joi or Zod)
├── database/                       # Prisma client, seeders, schema, and migrations
│   ├── prisma/
│   │   ├── schema.prisma           # Database schema with pgvector
│   │   └── migrations/
│   └── prisma.service.ts
└── modules/                        # Modular Monolith domains
    ├── auth/                       # Authentication, JWT, Refresh Tokens, Password Hashing
    ├── tenant/                     # Shop & Tenant management, Subscription plans, Multi-tenancy
    ├── ecommerce/                  # Multi-channel integrations (TikTok Shop, Shopee, Lazada)
    │   ├── common/                 # Base e-commerce adapter interfaces & types
    │   ├── tiktok/                 # TikTok Shop Open API client, webhooks, OAuth
    │   ├── shopee/                 # Shopee Open Platform client, webhooks, OAuth
    │   └── lazada/                 # Lazada Open Platform client, webhooks, OAuth
    ├── ai-agent/                   # LLM orchestration, Prompt Engine, Guardrails
    │   ├── chains/                 # LangChain conversation chains & agents
    │   ├── guardrails/             # Hallucination check, stock verification, safety filter
    │   └── prompt-templates/       # Prompt repository for sales, consulting, objection handling
    ├── rag/                        # Retrieval-Augmented Generation subsystem
    │   ├── embeddings/             # Embedding generator (text-embedding-3-small)
    │   ├── vector-store/           # pgvector repository & similarity search
    │   └── ingestion/              # Product catalog chunking & indexing pipeline
    ├── chat/                       # Unified omnichannel chat hub
    │   ├── gateway/                # WebSocket gateway for live seller dashboard chat
    │   ├── router/                 # Webhook message dispatcher to AI vs. human agent
    │   └── services/               # Chat session history, message persistence
    ├── products/                   # Catalog synchronization, variants, inventory management
    ├── trend-analyzer/             # Social trend scanning, viral script generator, SEO titles
    ├── analytics/                  # Financial reports, inventory velocity, return rate analysis
    ├── queues/                     # BullMQ processors (webhooks, sync, AI processing)
    │   ├── processors/             # WebhookProcessor, AiReplyProcessor, CatalogSyncProcessor
    │   └── queue.constants.ts      # Queue names and job configuration
    └── notifications/              # Alerting system (low stock, token expiration, system errors)
```

### Modular Monolith Rules:
1. **Module Independence:** Modules must communicate via exported injectable services or asynchronous events/BullMQ jobs, never by directly reaching into another module's internal database tables or repositories.
2. **Clean Dependency Inversion:** Controllers depend on Service interfaces; Services depend on domain logic and database abstractions.
3. **No Circular Dependencies:** Use `forwardRef()` only as an extreme exception; prefer event-driven communication (NestJS `EventEmitter2` or BullMQ).

---

## 3. Multi-Tenancy & Data Isolation Guidelines
- **Tenant Scope:** Every seller shop operates as an isolated tenant (`tenantId` / `shopId`).
- **Entity Constraint:** Every database model containing business data (Products, Orders, Customers, Messages, Embeddings, Analytics) **MUST** include `tenantId: String` or `shopId: String`.
- **Guard Enforcement:** All controller routes handling shop operations must be guarded by `JwtAuthGuard` and `TenantGuard`. The `TenantGuard` extracts and verifies the tenant context from the authenticated user.
- **Repository Filtering:** Every Prisma query **MUST** explicitly filter by `tenantId` / `shopId`. Never perform a bulk update, delete, or retrieval without an explicit tenant identifier:
  ```typescript
  // REQUIRED Pattern
  await this.prisma.product.findMany({
    where: { shopId, isActive: true },
  });
  ```
- **Vector Isolation:** In vector search queries (`pgvector`), the search filter **MUST** include `WHERE metadata->>'shopId' = :shopId` to prevent data leakage between competing sellers.

---

## 4. Coding & Quality Standards
- **TypeScript Strictness:** Strict mode is mandatory (`"strict": true`). Absolutely no use of `any`; use `unknown` with type guards or define explicit interfaces/types.
- **DTO Validation:** Every incoming HTTP request must have a strongly-typed Data Transfer Object (DTO) annotated with `class-validator` and `class-transformer`.
- **Unified API Response:** All REST endpoints must return a standardized response format:
  ```typescript
  export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
    timestamp: string;
  }
  ```
- **Centralized Exception Handling:** Throw standard NestJS HTTP exceptions (`NotFoundException`, `BadRequestException`, `UnauthorizedException`). All exceptions are formatted by `GlobalExceptionFilter` adhering to RFC 7807.
- **Logging Standards:** Use NestJS `Logger` with structured JSON logging (Winston or Pino) capturing `context`, `traceId`, `tenantId`, and `executionTimeMs`. Never log raw secrets, access tokens, or sensitive customer PII.

---

## 5. E-commerce Integration & Security Rules
- **Webhook Processing Speed:** All external webhooks (TikTok Shop, Shopee, Lazada) must respond with HTTP `200 OK` within **1 second** to prevent platform webhook timeouts and retry storms.
  - *Pattern:* Validate webhook signature -> Push payload to BullMQ `webhook-processing-queue` -> Return `{ received: true }` immediately.
- **Signature Verification:** Every webhook handler must verify the cryptographic signature:
  - TikTok Shop: HMAC-SHA256 with App Secret over raw request body and timestamp.
  - Shopee: SHA256 signature with partner key and request URL.
  - Lazada: HMAC-SHA256 signature verification.
- **Token Security:** E-commerce OAuth access tokens and refresh tokens must be encrypted at rest in PostgreSQL using **AES-256-GCM** before saving, and decrypted in-memory only when calling platform APIs.
- **Rate-Limiting & Backoff:** Calls to platform APIs must respect platform rate limits using Redis-based token buckets and exponential backoff.

---

## 6. AI, RAG & LLM Guardrails
- **Ground Truth Grounding:** AI customer responses must be grounded strictly in the shop's vectorized catalog and shop policy documents.
- **Live Inventory Verification:** The AI must **never** commit to an order or state that an item is in stock solely based on vector retrieval. Before confirming stock, the AI chain must invoke a live database check (`inventory.checkStock(skuId)`).
- **Prompt Injection Defense:** Customer inputs must be sanitized. System instructions must strictly enforce that customer inputs cannot override shop rules, discounts, or policies.
- **Fallback to Human Agent:** If confidence score is below threshold (< 0.75) or if the customer expresses frustration/anger (detected via sentiment classification), the system must seamlessly route the conversation to the seller's manual dashboard and notify the seller.
- **Latency Target:** First-token latency for AI responses should stay under **1.5 seconds**, and full response under **2.5 seconds**.

---

## 7. Queue & Asynchronous Processing with BullMQ
- Use dedicated named queues:
  - `webhooks-queue`: Ingests and routes multi-channel webhook events.
  - `ai-chat-queue`: Generates LLM responses and dispatches reply messages back to platform APIs.
  - `catalog-sync-queue`: Fetches and vectorizes shop product catalogs.
  - `trend-analyzer-queue`: Scrapes trending hashtags and generates video scripts.
  - `analytics-report-queue`: Aggregates hourly/daily financial and inventory statistics.
- All jobs must configure exponential backoff retries (`attempts: 3`, `backoff: { type: 'exponential', delay: 2000 }`) and Dead Letter Queues (DLQ) for failed jobs.

---

## 8. Development Roadmap & Milestones (8 Weeks)
- **Phase 1: Research, Architecture & Specs (Weeks 1-2)**
  - Establish Modular Monolith scaffolding, Prisma PostgreSQL schema with pgvector, Redis config.
  - Define OpenAPI/Swagger specifications for multi-tenant auth, webhooks, and chat.
- **Phase 2: Core Backend, Integrations & AI Engine (Weeks 3-5)**
  - Week 3: Auth module (JWT, OAuth), Shop/Tenant management, Database migrations.
  - Week 4: Multi-channel Webhook receivers (TikTok, Shopee), RAG pipeline with pgvector, Automated Chatbot responder.
  - Week 5: Analytics aggregation engine, Trend & Script generation services, BullMQ processors.
- **Phase 3: Real-Time Chat, Frontend Integration & QA (Weeks 6-7)**
  - Real-time WebSocket gateway for live agent handover.
  - End-to-End testing, rate-limiting, security audits (CORS, token encryption, webhook signatures).
- **Phase 4: Containerization, Deployment & Beta Launch (Week 8)**
  - Multi-stage Docker build, Docker Compose staging environment, Cloud deployment (Railway/AWS).
  - Beta onboarding with pilot e-commerce sellers.

---

## 9. Available Workspace Skills & Domain Mapping

Antigravity and pair-programming agents can load specialized runbooks and procedural guides on-demand:

Skill Name | Path | Purpose
:--- | :--- | :---
[`backend-nest`](file:///d:/PhamBaBac/OmniAi_Seller_Hub/back-end/.agents/skills/backend-nest/SKILL.md) | `.agents/skills/backend-nest` | Modular Monolith scaffolding, Prisma ORM, multi-tenant isolation, DTO validation.
[`ai-rag`](file:///d:/PhamBaBac/OmniAi_Seller_Hub/back-end/.agents/skills/ai-rag/SKILL.md) | `.agents/skills/ai-rag` | pgvector setup, catalog chunking, hybrid retrieval, stock guardrails, customer support chat.
[`ecommerce-integrations`](file:///d:/PhamBaBac/OmniAi_Seller_Hub/back-end/.agents/skills/ecommerce-integrations/SKILL.md) | `.agents/skills/ecommerce-integrations` | TikTok Shop, Shopee, Lazada webhook receivers, HMAC-SHA256 signature verification, AES-256 token encryption.
[`queue-redis-bullmq`](file:///d:/PhamBaBac/OmniAi_Seller_Hub/back-end/.agents/skills/queue-redis-bullmq/SKILL.md) | `.agents/skills/queue-redis-bullmq` | BullMQ queues, worker processors, exponential backoff, dead-letter queues, Redis rate limiter.
[`trend-content-analyzer`](file:///d:/PhamBaBac/OmniAi_Seller_Hub/back-end/.agents/skills/trend-content-analyzer/SKILL.md) | `.agents/skills/trend-content-analyzer` | Short video scripts (Hook-Problem-Solution-CTA), SEO title optimizer, review sentiment mining.
[`analytics-reporting`](file:///d:/PhamBaBac/OmniAi_Seller_Hub/back-end/.agents/skills/analytics-reporting/SKILL.md) | `.agents/skills/analytics-reporting` | Multi-channel revenue/profit aggregation, inventory stockout forecasting (DIR), AI return root-cause summary.
[`auto-test`](file:///d:/PhamBaBac/OmniAi_Seller_Hub/back-end/.agents/skills/auto-test/SKILL.md) | `.agents/skills/auto-test` | Jest unit/integration tests, external API/LLM mocking, tenant boundary tests, 80%+ coverage gates.
[`devops-docker`](file:///d:/PhamBaBac/OmniAi_Seller_Hub/back-end/.agents/skills/devops-docker/SKILL.md) | `.agents/skills/devops-docker` | Multi-stage Dockerfile, docker-compose (pgvector + Redis + API), healthchecks, Railway/AWS deploy.

