# GrowthCat Roadmap

The build plan for GrowthCat, an autonomous DX advocate agent for RevenueCat. Organized as two tracks of vertical slices. **Track A** (application-critical) is the minimum required to submit the application. **Track B** (operating product) demonstrates the full weekly system.

For product requirements, goals, and scope, see [PRD](docs/product/2026-03-13-growthcat-prd.md).

---

## Table of Contents

### Track A: Application-Critical
1. [VS-A1: The Brain Works](#vs-a1-the-brain-works) — Knowledge ingestion + Convex Agent + RAG
2. [VS-A2: The Chat Works](#vs-a2-the-chat-works) — Chat widget + panel console use Convex Agent
3. [VS-A3: Deploy + Submit](#vs-a3-deploy--submit) — Public URL, application submitted

### Track B: Operating Product
4. [VS-B1: The Pipeline Works](#vs-b1-the-pipeline-works) — Content generation, approval, publish to Convex
5. [VS-B2: The Loop Works](#vs-b2-the-loop-works) — Full weekly Mon-Fri cycle
6. [VS-B3: The Dashboard Works](#vs-b3-the-dashboard-works) — Live data in operator console
7. [VS-B4: The Experiment Works](#vs-b4-the-experiment-works) — Measure + report
8. [VS-B5: The Onboarding Works](#vs-b5-the-onboarding-works) — Server-only secrets, agentConfig for preferences

### Reference
9. [Approval Model](#approval--human-in-the-loop-model)
10. [Architecture Overview](#architecture-overview)
11. [Convex Schema (Complete)](#convex-schema-complete)
12. [Growth Levers](#growth-levers)
13. [Ownership Model](#ownership-model)
14. [Security Model](#security-model)
15. [Open Decisions](#open-decisions)
16. [Risks](#risks)

---

## Two-Track Sequencing

The application only needs: brain + chat + static proof articles + deploy. The full operating product demonstrates the weekly system for take-home, panel, and founder stages.

```
Track A (application — submit to RC careers page):
  VS-A1 (brain + RAG) → VS-A2 (chat + panel) → VS-A3 (deploy + submit)

Track B (operating product — can start after VS-A1):
  VS-B1 (content pipeline) → VS-B2 (weekly cycle) → VS-B3 (dashboard)
                                                   → VS-B4 (experiments)
                                                   → VS-B5 (onboarding persistence)
```

**Track A delivers**: a public URL where RC can talk to GrowthCat via the chat widget, see static proof articles (already hardcoded as seed content), and explore the operator replay page. This is sufficient for Stage 1 (Application).

**Track B delivers**: the full operating system — content generation with approval flow, weekly Monday-Friday cycle, live dashboard, experiments with measurement, and secure onboarding. This is required for Stage 2 (Take-Home), Stage 3 (Panel), and Stage 4 (Founder).

VS-B1 depends on VS-A1 (needs the brain for RAG-grounded content generation). VS-B3/B4/B5 can proceed in parallel once VS-B2 has run at least one cycle.

---

## VS-A1: The Brain Works

**Goal**: GrowthCat can answer specific RevenueCat questions accurately from ingested docs. The Convex Agent has persistent threads, message history, tool calling, and explicit custom-document RAG on every response.

**Dependencies**: Anthropic API key (set in `.env.local`), Convex deployed (done), OpenAI API key for embeddings (add `OPENAI_API_KEY` to `.env.local`)

### Critical distinction: thread search vs custom document RAG

The Convex Agent component (`@convex-dev/agent`) provides **automatic** search over thread messages (conversation memory). It does **NOT** automatically search custom tables like our `sources` table with ingested RC docs. Custom knowledge requires **explicit** retrieval via one of two mechanisms:

1. **contextHandler** (recommended) — runs vector search on the `sources` table BEFORE every LLM call, injecting top-k results as system context. This is consistent (always runs) but adds latency.
2. **Tool-based RAG** — a `searchDocs` tool the agent calls when it needs to ground its response. Simpler to implement but less consistent (agent might not call it).

This roadmap uses **both**: a `searchDocs` tool for explicit retrieval, plus a `contextHandler` that always injects the most relevant source documents.

### What gets built

#### 1. Convex schema update: add vector embedding to `sources` table

**File**: `convex/schema.ts`

The current `sources` table has no `embedding` field and no vector index. Add both:

```typescript
// In convex/schema.ts — replace the current sources table definition

sources: defineTable({
  key: v.string(),
  url: v.optional(v.string()),
  provider: v.string(),
  sourceClass: v.string(),
  evidenceTier: v.string(),
  lastRefreshed: v.number(),
  contentHash: v.string(),
  summary: v.optional(v.string()),
  chunkText: v.string(),           // NEW: the actual text chunk
  chunkIndex: v.optional(v.number()), // NEW: position within the source
  embedding: v.array(v.float64()), // NEW: 1536-dim embedding vector
})
  .index("by_provider", ["provider"])
  .index("by_key", ["key"])
  .vectorIndex("by_embedding", {   // NEW: vector search index
    vectorField: "embedding",
    dimensions: 1536,
    filterFields: ["provider", "sourceClass"],
  }),
```

#### 2. Enable Convex Agent component

**File**: `convex/convex.config.ts`

Currently the agent import is commented out. Uncomment it:

```typescript
import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config.js";

const app = defineApp();
app.use(agent);

export default app;
```

#### 3. Knowledge ingestion Inngest function

**New file**: `inngest/ingest-knowledge.ts`

This function crawls RC docs, chunks them, embeds them via OpenAI `text-embedding-3-small`, and stores them in Convex.

Crawl targets (all public, no auth needed):
- RevenueCat docs: `https://www.revenuecat.com/docs/` (sitemap at `/docs/sitemap.xml`)
- RevenueCat blog: `https://www.revenuecat.com/blog/` (last 50 posts)
- RevenueCat changelog: `https://www.revenuecat.com/docs/changelog`
- RevenueCat SDK READMEs: fetch from GitHub API (`https://api.github.com/repos/RevenueCat/{repo}/readme`)
  - Repos: `purchases-ios`, `purchases-android`, `purchases-flutter`, `purchases-react-native`, `purchases-unity`

Processing pipeline per source:
1. Fetch HTML/markdown content
2. Strip HTML tags, extract text
3. Split into chunks: 500 tokens max, 50 token overlap, preserve paragraph boundaries
4. For each chunk: call OpenAI embedding API (`text-embedding-3-small`, 1536 dimensions)
5. Compute content hash (`SHA-256` of chunk text)
6. Upsert to Convex `sources` table — skip if content hash matches existing record (dedup)

```typescript
// inngest/ingest-knowledge.ts — key structure (not complete implementation)

import { inngest } from "./client";
import { convexStore } from "@/lib/convex-client";

export const ingestKnowledge = inngest.createFunction(
  { id: "ingest-knowledge", name: "Ingest Knowledge Base" },
  { event: "growthcat/knowledge.ingest" },
  async ({ step }) => {
    // Step 1: Fetch sitemap or URL list
    const urls = await step.run("fetch-urls", async () => { /* ... */ });

    // Step 2: For each URL, fetch content
    for (const url of urls) {
      const content = await step.run(`fetch-${url.key}`, async () => { /* ... */ });

      // Step 3: Chunk the content
      const chunks = await step.run(`chunk-${url.key}`, async () => {
        return chunkText(content.text, { maxTokens: 500, overlap: 50 });
      });

      // Step 4: Embed and store each chunk
      await step.run(`embed-store-${url.key}`, async () => {
        const embeddings = await embedChunks(chunks); // OpenAI text-embedding-3-small
        for (let i = 0; i < chunks.length; i++) {
          const hash = sha256(chunks[i]);
          await convexStore("/api/sources", {
            key: `${url.key}:chunk:${i}`,
            url: url.url,
            provider: url.provider,
            sourceClass: url.sourceClass,
            evidenceTier: url.evidenceTier,
            lastRefreshed: Date.now(),
            contentHash: hash,
            chunkText: chunks[i],
            chunkIndex: i,
            embedding: embeddings[i],
          });
        }
      });
    }
  }
);
```

Register this function in `app/api/inngest/route.ts` alongside the existing functions.

#### 4. Convex sources HTTP endpoint update

**File**: `convex/http.ts`

Add a new POST endpoint for upserting sources with embeddings. The current `sources.upsert` mutation in `convex/sources.ts` needs to accept the new fields (`chunkText`, `chunkIndex`, `embedding`).

**File**: `convex/sources.ts`

Update the `upsert` mutation args to include the new fields. Add a new `vectorSearch` action:

```typescript
// convex/sources.ts — add vector search action

export const vectorSearch = action({
  args: {
    embedding: v.array(v.float64()),
    limit: v.optional(v.number()),
    provider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const results = await ctx.vectorSearch("sources", "by_embedding", {
      vector: args.embedding,
      limit: args.limit ?? 10,
      filter: args.provider
        ? (q) => q.eq("provider", args.provider!)
        : undefined,
    });
    // Fetch full documents for each result
    const docs = await Promise.all(
      results.map(async (r) => {
        const doc = await ctx.runQuery(internal.sources.getById, { id: r._id });
        return { ...doc, score: r._score };
      })
    );
    return docs;
  },
});
```

#### 5. Convex Agent definition with correct API names

**New file**: `convex/agent.ts`

This replaces the raw `streamText` calls in `app/api/chat/route.ts` and `app/api/panel/session/route.ts`.

**IMPORTANT**: Uses the correct `@convex-dev/agent` API names:
- Constructor parameter: `languageModel` (NOT `chat`)
- Embedding parameter: `textEmbeddingModel` (NOT `textEmbedding`)
- searchOptions: `{ textSearch, vectorSearch, limit, messageRange }` (NOT weights)
- Import: `import { Agent, createTool } from "@convex-dev/agent"` (NOT `@convex-dev/agents`)

```typescript
// convex/agent.ts

import { Agent, createTool } from "@convex-dev/agent";
import { components, internal } from "./_generated/api";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

export const growthCatAgent = new Agent(components.agent, {
  name: "GrowthCat",
  languageModel: anthropic.chat("claude-sonnet-4-20250514"),
  textEmbeddingModel: openai.embedding("text-embedding-3-small"),
  instructions: GROWTHCAT_SYSTEM_PROMPT, // the system prompt from app/api/chat/route.ts
  tools: {
    searchDocs: createTool({
      description: "Search RevenueCat documentation for relevant information",
      args: z.object({ query: z.string() }),
      handler: async (ctx, { query }) => {
        // Generate embedding for the query
        const embeddingResult = await ctx.runAction(internal.sources.embedText, { text: query });
        // Vector search on sources table
        const results = await ctx.vectorSearch("sources", "by_embedding", {
          vector: embeddingResult,
          limit: 5,
        });
        const docs = await Promise.all(results.map(r => ctx.db.get(r._id)));
        return docs.filter(Boolean).map(d => `[${d!.key}]: ${d!.summary ?? d!.chunkText}`).join("\n\n");
      },
    }),
  },
  contextOptions: {
    recentMessages: 20,
    searchOtherThreads: false,
    searchOptions: {
      textSearch: true,
      vectorSearch: true,
      limit: 10,
      messageRange: { before: 1, after: 1 },
    },
  },
  // EXPLICIT custom document RAG — this is NOT automatic
  // The contextHandler runs before every LLM call and injects relevant
  // documents from our sources table as system context
  contextHandler: async (ctx, args) => {
    // Extract the user's latest message to use as search query
    const query =
      args.inputPrompt?.[0]?.content ??
      args.inputMessages?.slice(-1)?.[0]?.content ??
      "";

    if (typeof query === "string" && query.length > 0) {
      // Generate embedding for the query
      const embedding = await ctx.runAction(internal.sources.embedText, { text: query });
      // Search our custom sources table for docs relevant to this conversation
      const docResults = await ctx.vectorSearch("sources", "by_embedding", {
        vector: embedding,
        limit: 5,
      });
      // Fetch full doc content
      const docs = await Promise.all(docResults.map(r => ctx.db.get(r._id)));
      const docContext = docs.filter(Boolean).map(d => ({
        role: "system" as const,
        content: `[Source: ${d!.provider} — ${d!.key}]\n${d!.summary ?? d!.chunkText}`,
      }));
      // Return: doc context first, then thread search results, then recent messages, then input
      return [
        ...docContext,
        ...args.search,
        ...args.recent,
        ...args.inputMessages,
        ...args.inputPrompt,
        ...args.existingResponses,
      ];
    }

    // Fallback: no custom docs, just use default context
    return [
      ...args.search,
      ...args.recent,
      ...args.inputMessages,
      ...args.inputPrompt,
      ...args.existingResponses,
    ];
  },
});
```

#### 6. Convex chat actions (thread management)

**New file**: `convex/chat.ts`

```typescript
// convex/chat.ts

import { action } from "./_generated/server";
import { v } from "convex/values";
import { growthCatAgent } from "./agent";

export const createThread = action({
  args: {},
  handler: async (ctx) => {
    const { threadId } = await growthCatAgent.createThread(ctx, {});
    return { threadId };
  },
});

export const chat = action({
  args: {
    prompt: v.string(),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, { prompt, threadId }) => {
    if (threadId) {
      const { thread } = await growthCatAgent.continueThread(ctx, { threadId });
      const result = await thread.generateText({ prompt });
      return { threadId, text: result.text };
    }
    const { threadId: newId, thread } = await growthCatAgent.createThread(ctx, {});
    const result = await thread.generateText({ prompt });
    return { threadId: newId, text: result.text };
  },
});

export const streamChat = action({
  args: {
    prompt: v.string(),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, { prompt, threadId }) => {
    if (threadId) {
      const { thread } = await growthCatAgent.continueThread(ctx, { threadId });
      return await thread.streamText({ prompt });
    }
    const { threadId: newId, thread } = await growthCatAgent.createThread(ctx, {});
    return { threadId: newId, stream: await thread.streamText({ prompt }) };
  },
});
```

#### 7. Embedding helper action

**File**: `convex/sources.ts`

Add an internal action that generates embeddings for queries:

```typescript
// convex/sources.ts — add embedding helper

export const embedText = internalAction({
  args: { text: v.string() },
  handler: async (_ctx, { text }) => {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
      }),
    });
    const data = await response.json();
    return data.data[0].embedding; // 1536-dim vector
  },
});
```

### What gets ingested (target counts)

| Source | Est. pages | Est. chunks |
| --- | --- | --- |
| RevenueCat docs (docs.revenuecat.com) | ~200 pages | ~800 chunks |
| RevenueCat SDK READMEs (5 repos) | 5 | ~50 chunks |
| RevenueCat blog (last 50 posts) | 50 | ~250 chunks |
| RevenueCat changelog | ~20 entries | ~40 chunks |
| **Total** | **~275** | **~1,140** |

### Demo

1. Run knowledge ingestion: `growthcat/knowledge.ingest` event in Inngest dashboard
2. Verify 500+ source chunks stored in Convex `sources` table with embeddings
3. Open chat widget on the public site
4. Ask: "What events does RevenueCat send via webhooks?"
5. GrowthCat answers with the complete list (INITIAL_PURCHASE, RENEWAL, CANCELLATION, BILLING_ISSUE, EXPIRATION, PRODUCT_CHANGE, etc.) citing the specific docs page URL — this answer comes from the **contextHandler** injecting relevant source chunks, NOT from the system prompt alone
6. Ask: "What's the difference between offerings and entitlements?"
7. GrowthCat explains accurately: offerings are what you sell (packages of products), entitlements are access control (what the customer unlocks) — citing the correct docs sections

### Exit criteria

- [ ] 500+ source chunks stored in Convex `sources` table with embeddings (verify: `npx convex data sources --limit 1` shows embedding field)
- [ ] `convex/convex.config.ts` has `app.use(agent)` uncommented and deployed
- [ ] `convex/agent.ts` exists with `growthCatAgent` definition using correct API names (`languageModel`, `textEmbeddingModel`, `searchOptions` with `textSearch`/`vectorSearch`/`messageRange`)
- [ ] `contextHandler` in agent definition runs vector search on `sources` table BEFORE every LLM call
- [ ] `searchDocs` tool exists on the agent for explicit retrieval
- [ ] `convex/chat.ts` exists with `createThread`, `chat`, `streamChat` actions
- [ ] Ask 10 RC-specific questions via chat, 9/10 are accurate AND cite ingested source documents (not just system prompt knowledge) — test manually
- [ ] Thread persistence: close chat, reopen, conversation history loads from Convex
- [ ] `OPENAI_API_KEY` added to `.env.example` with comment for embeddings

### Expected outcomes

**What the user sees**: Chat widget answers RC questions with specific doc citations. Answers reference specific API endpoints, webhook event names, SDK methods from ingested docs.

**What is stored in Convex**: `sources` table has 500+ rows with `chunkText`, `embedding` (1536-dim), `provider`, `key`. Agent component tables have thread records and message history.

### Files touched

| File | Action |
| --- | --- |
| `convex/schema.ts` | Edit: add `chunkText`, `chunkIndex`, `embedding`, vector index to `sources` |
| `convex/convex.config.ts` | Edit: uncomment `app.use(agent)` |
| `convex/sources.ts` | Edit: update `upsert` args, add `vectorSearch` action, add `getById` internal query, add `embedText` internal action |
| `convex/agent.ts` | New: Convex Agent definition with contextHandler + searchDocs tool |
| `convex/chat.ts` | New: thread management actions |
| `convex/http.ts` | Edit: add `/api/sources` POST endpoint for embeddings |
| `inngest/ingest-knowledge.ts` | New: knowledge ingestion function |
| `app/api/inngest/route.ts` | Edit: register `ingestKnowledge` function |
| `.env.example` | Edit: add `OPENAI_API_KEY` |

### Environment variables needed

| Variable | Purpose | Status |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | LLM for chat and content | Set |
| `OPENAI_API_KEY` | Embeddings (`text-embedding-3-small`) | Need to add |
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment | Set |

---

## VS-A2: The Chat Works

**Goal**: Chat widget and panel console use Convex Agent threads with RAG. Both are ready for RC to interact with on the public site.

**Dependencies**: VS-A1 (agent brain with ingested knowledge)

### What gets built

#### 1. Update chat widget to use Convex Agent threads

**File**: `app/components/Chat.tsx`

Replace `useChat({ api: "/api/chat" })` with Convex action calls. Store `threadId` in component state so conversations persist across messages.

**File**: `app/api/chat/route.ts`

Keep as a thin proxy that calls `convex/chat.ts` actions and streams the response back. Alternatively, the Chat.tsx component can call Convex actions directly via the Convex React client.

#### 2. Update panel console to use Convex Agent

**File**: `app/api/panel/session/route.ts`

Replace the hardcoded `retrieveSources()` function with actual Convex vector search. The SSE streaming structure stays the same, but the source retrieval and LLM call now go through the Convex Agent.

Each panel session gets a Convex Agent thread. The interviewer can:
- See the session history after the interview (thread persists in Convex)
- Resume a session if the connection drops
- Review what sources the agent cited

Add `threadId` to the panel SSE query params. If provided, continue the existing thread. If not, create a new one.

### Demo

1. Open chat widget on the public site
2. Ask: "What events does RevenueCat send via webhooks?"
3. GrowthCat answers accurately, citing specific docs — response comes from Convex Agent with contextHandler RAG
4. Close the chat widget, reopen it — the conversation is still there (thread persistence)
5. Open the panel console at `/panel`, type a prompt
6. See sources retrieved from actual ingested RC docs (not the hardcoded `retrieveSources()` list)
7. Panel response references specific RC doc pages with URLs

### Exit criteria

- [ ] Chat widget uses Convex Agent threads (not raw `useChat({ api: "/api/chat" })`)
- [ ] Chat widget responses cite specific RC docs URLs (from contextHandler RAG, not system prompt)
- [ ] Thread persistence: close chat, reopen, conversation history loads from Convex
- [ ] Panel console retrieves real sources from vector search (not hardcoded list)
- [ ] Panel SSE `sources_retrieved` event includes actual doc URLs with relevance scores
- [ ] Panel thread persists in Convex (replayable after session ends)
- [ ] Streaming is smooth (no long pauses, tokens flow continuously)

### Expected outcomes

**What the user sees**: Chat widget on the public site gives grounded, cited answers. Panel console shows real source documents being retrieved. Both persist conversation history.

**What is stored in Convex**: Agent thread records with message history. Each message includes the sources that were used to generate the response.

### Files touched

| File | Action |
| --- | --- |
| `app/components/Chat.tsx` | Edit: use Convex Agent threads instead of `useChat` |
| `app/api/chat/route.ts` | Edit: replace raw `streamText` with Convex Agent call |
| `app/api/panel/session/route.ts` | Edit: replace `retrieveSources()` with real vector search + Convex Agent |
| `app/(operator)/panel/page.tsx` | Edit: pass thread ID for persistence |

---

## VS-A3: Deploy + Submit

**Goal**: Public URL exists. Chat widget works with RAG. Static proof articles visible. Application submitted to RevenueCat careers page.

**Dependencies**: VS-A2 (chat and panel working with RAG)

**Note**: Static proof articles stay as hardcoded seed content in `app/(public)/articles/[slug]/page.tsx`. They are already good. Dynamic articles from Convex come in VS-B1.

### What gets built

#### 1. Vercel deployment

**Files**: `vercel.json` (if needed), existing `next.config.ts`

- Deploy to Vercel via `bunx vercel deploy --prod` (script already in `package.json`)
- Set all environment variables in Vercel dashboard:

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | Convex production URL |
| `ANTHROPIC_API_KEY` | LLM |
| `OPENAI_API_KEY` | Embeddings |
| `GROWTHCAT_INTERNAL_SECRET` | Inngest-Convex auth |
| `GROWTHCAT_PANEL_TOKEN` | Panel auth |

#### 2. Convex production deployment

```bash
bunx convex deploy --prod
```

Set the same `GROWTHCAT_INTERNAL_SECRET` in Convex environment variables (Convex dashboard → Settings → Environment Variables).

#### 3. Domain setup

Options: `growthcat.dev`, `growthcat.ai`, or a Vercel subdomain. Configure in Vercel dashboard → Domains.

#### 4. Smoke test on production

Run through each page on the production URL:

| Page | Check |
| --- | --- |
| `/` (landing) | Loads, chat widget appears, chat works with RAG |
| `/application` | Full application letter renders |
| `/proof-pack` | Links to articles work |
| `/articles` | Article list renders (hardcoded seed articles) |
| `/articles/[slug]` | Individual article renders |
| `/readiness-review` | Self-assessment renders |
| `/operator-replay` | Architecture page renders |
| `/panel` | SSE streaming works, RAG sources appear |

#### 5. Submit application

- Navigate to RevenueCat careers page
- Submit the public URL
- Include link to proof pack and chat widget

### Exit criteria

- [ ] Public URL loads (all pages, no 500 errors)
- [ ] Chat widget streams RAG-grounded responses on the public URL (not localhost)
- [ ] Panel console accessible and SSE streaming works on production
- [ ] Convex production deployment is live (not dev)
- [ ] Domain configured (not just `*.vercel.app`)
- [ ] URL submitted to RevenueCat careers page

### Expected outcomes

**What the user sees**: A public website at a stable URL. Chat widget answers RC questions intelligently. Proof pack articles are visible. Panel console works for live demos.

**What is stored in Convex**: Production database with ingested sources and agent threads.

### Files touched

| File | Action |
| --- | --- |
| `vercel.json` | New or edit: any Vercel-specific config |
| `package.json` | Verify: `deploy` script works |

---

## VS-B1: The Pipeline Works

**Goal**: Generate one piece of content end-to-end, get it approved in Slack, publish it to the Convex `artifacts` table (primary), distribute via GitHub (backup/SEO) and Typefully. The article appears on the microsite by querying Convex. Full audit trail.

**Dependencies**: VS-A1 (agent brain for content generation with RAG context)

### Critical fix: Publishing connects to rendered articles

The current `lib/cms/publish.ts` writes markdown to GitHub, but the article pages (`app/(public)/articles/[slug]/page.tsx`) render from hardcoded JSX arrays. Publishing to GitHub does NOT make content appear on the site.

**The fix**: Published articles are stored in the Convex `artifacts` table with `status: "published"`. The article pages query Convex for published artifacts. GitHub commit is a SECONDARY distribution step (for SEO/backup), not the primary publishing mechanism.

The article pages must handle BOTH:
- **Seed articles**: The existing hardcoded JSX articles (the initial proof pack) — these render without Convex
- **Dynamic articles**: Artifacts from Convex with `status: "published"` — these render from markdown stored in the `content` field

### What gets built

#### 1. Convex schema update: approval fields on `artifacts` table

**File**: `convex/schema.ts`

Add approval tracking fields to the existing `artifacts` table:

```typescript
// Add these fields to the artifacts table definition in convex/schema.ts

artifacts: defineTable({
  // ... existing fields ...
  artifactType: v.string(),
  title: v.string(),
  slug: v.string(),
  content: v.string(),
  contentFormat: v.string(),
  status: v.string(),
  metadata: v.optional(v.any()),
  qualityScores: v.optional(v.any()),
  llmProvider: v.optional(v.string()),
  llmModel: v.optional(v.string()),
  inputTokens: v.optional(v.number()),
  outputTokens: v.optional(v.number()),
  publishedAt: v.optional(v.number()),
  // NEW approval fields:
  approvalState: v.optional(v.string()),   // "pending" | "approved" | "rejected" | "auto"
  approvedBy: v.optional(v.string()),      // Slack user ID
  approvedAt: v.optional(v.number()),      // timestamp
  reviewMode: v.optional(v.string()),      // "draft_only" | "auto_publish"
  slackThreadTs: v.optional(v.string()),   // Slack thread for this draft
  typefullyDraftIds: v.optional(v.any()),  // array of Typefully draft IDs
  githubCommitSha: v.optional(v.string()), // SHA of the publish commit
})
  .index("by_type_status", ["artifactType", "status"])
  .index("by_slug", ["slug"])
  .index("by_approval", ["approvalState"])  // NEW
  .searchIndex("search_content", {
    searchField: "content",
    filterFields: ["artifactType"],
  }),
```

#### 2. Convex artifacts query for published articles

**File**: `convex/artifacts.ts`

Add queries that the article pages will use:

```typescript
// convex/artifacts.ts — add queries for article rendering

export const listPublished = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("artifacts")
      .withIndex("by_type_status", (q) =>
        q.eq("artifactType", "blog_post").eq("status", "published")
      )
      .order("desc")
      .collect();
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("artifacts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
  },
});
```

#### 3. Update article pages to query Convex + render seed articles

**File**: `app/(public)/articles/page.tsx`

The article index page queries `api.artifacts.listPublished` to get dynamic articles from Convex, then merges them with the hardcoded seed articles. Seed articles are listed first (they are the initial proof pack).

**File**: `app/(public)/articles/[slug]/page.tsx`

The individual article page:
1. First checks if the slug matches a hardcoded seed article — if so, renders the JSX content
2. If not, queries `api.artifacts.getBySlug({ slug })` to get the article from Convex
3. If found and `status === "published"`, renders the markdown `content` field (use a markdown renderer like `react-markdown`)
4. If not found, returns 404

#### 4. New Convex table: `approvalLog`

**File**: `convex/schema.ts`

Tracks every approval/rejection/override for audit:

```typescript
approvalLog: defineTable({
  artifactId: v.id("artifacts"),
  action: v.string(),        // "submitted" | "approved" | "rejected" | "auto_approved" | "override"
  actor: v.optional(v.string()), // Slack user ID, or "system"
  reason: v.optional(v.string()),
  timestamp: v.number(),
}).index("by_artifact", ["artifactId"]),
```

#### 5. Content generation upgrade in Inngest

**File**: `inngest/functions.ts` — `generateContent` function

Update the existing content generation function to:
1. Use the Convex Agent for draft generation (RAG-grounded, not raw `generateText`)
2. Store the generated draft in Convex `artifacts` table with `status: "draft"`
3. After quality gates pass, check `agentConfig` review mode:
   - If `"auto_publish"`: transition artifact to `status: "published"`, log `auto_approved` in `approvalLog`
   - If `"draft_only"`: post draft summary to Slack, set `approvalState: "pending"`, wait for Slack reaction event
4. Store quality gate results in the artifact's `qualityScores` field
5. If any blocking gate fails: set `status: "rejected"`, post to Slack with failure reason

After quality gate pass and approval, emit `growthcat/content.publish` event.

#### 6. New Inngest function: content publishing

**New file**: `inngest/publish-content.ts`

Triggered by `growthcat/content.publish` event. Steps:
1. Fetch artifact from Convex by ID
2. **PRIMARY**: Update artifact in Convex: `status: "published"`, `publishedAt: Date.now()` — this makes the article appear on the microsite immediately (article pages query Convex)
3. **SECONDARY (backup/SEO)**: Publish to GitHub as markdown with frontmatter (uses existing `lib/cms/publish.ts` `publishArticle`)
4. **SECONDARY (distribution)**: Create Typefully drafts for distribution (X, LinkedIn)
5. Update artifact with `typefullyDraftIds`, `githubCommitSha`
6. Log `published` in `approvalLog`

#### 7. Slack approval handler

**File**: `inngest/slack-handler.ts`

Add a new Inngest function to handle Slack reaction events:

```typescript
// New event handler for Slack reactions on approval posts
export const handleSlackReaction = inngest.createFunction(
  { id: "slack-reaction-handler", name: "Handle Slack Reaction" },
  { event: "growthcat/slack.reaction" },
  async ({ event, step }) => {
    const { reaction, artifactId, channel, messageTs, userId } = event.data;

    if (reaction === "+1" || reaction === "white_check_mark") {
      // Approve: update artifact, log approval, trigger publish
      await step.run("approve", async () => {
        await convexStore("/api/artifacts/approve", {
          id: artifactId,
          approvalState: "approved",
          approvedBy: userId,
          approvedAt: Date.now(),
        });
        await convexStore("/api/approval-log", {
          artifactId,
          action: "approved",
          actor: userId,
          timestamp: Date.now(),
        });
      });

      await step.sendEvent("publish", {
        name: "growthcat/content.publish",
        data: { artifactId },
      });
    }
  }
);
```

**File**: `app/api/slack/events/route.ts`

Add handling for `reaction_added` events alongside the existing `app_mention` and `message` handlers. When a reaction is added to a GrowthCat approval post, send a `growthcat/slack.reaction` event to Inngest.

#### 8. HTTP endpoints for new tables

**File**: `convex/http.ts`

Add POST endpoints:
- `/api/approval-log` — log approval actions
- `/api/artifacts/approve` — update artifact approval state

### Approval flow (explicit)

```
Content generated by LLM (with RAG context from VS-A1)
  → Quality gates run (8 gates from lib/config/quality.ts)
  → IF all blocking gates pass AND reviewMode === "auto_publish":
      → Log "auto_approved" in approvalLog
      → Update artifact: status "published", publishedAt (PRIMARY — appears on site)
      → Commit to GitHub (SECONDARY — backup/SEO)
      → Create Typefully drafts (SECONDARY — distribution)
  → IF all blocking gates pass AND reviewMode === "draft_only":
      → Post to Slack: "[Title] - Draft ready. Quality gates: all passed. React with a thumbs up to approve."
      → Set artifact: approvalState "pending", slackThreadTs
      → Log "submitted" in approvalLog
      → WAIT for Slack reaction event
      → Thumbs up reaction → Log "approved" → Publish (Convex PRIMARY, GitHub + Typefully SECONDARY)
      → Reply with feedback → Log "rejected" with feedback → Re-generate with feedback
  → IF any blocking gate fails:
      → Set artifact: status "rejected"
      → Post to Slack: "[Title] - Blocked by [gate]. Reason: [reason]."
      → Log "rejected" in approvalLog with gate failure details
```

### Demo

1. Trigger content generation: send `growthcat/content.generate` event via Inngest dashboard
2. See the Inngest function run: draft generated with RAG context, quality gates executed
3. See draft stored in Convex `artifacts` table with `status: "draft"`
4. See draft summary appear in Slack with approval prompt
5. React with thumbs up emoji in Slack
6. See artifact status change to `"published"` in Convex
7. See the article appear on the microsite at `/articles/[slug]` — rendered from Convex query, not hardcoded JSX
8. See GitHub commit created (secondary/backup)
9. See Typefully draft created and scheduled (secondary/distribution)

### Exit criteria

- [ ] One article generated by LLM with RAG grounding (references ingested docs)
- [ ] Draft artifact stored in Convex `artifacts` table with `status: "draft"` and `qualityScores`
- [ ] Approval post appears in Slack with draft summary
- [ ] Thumbs up reaction triggers publishing pipeline
- [ ] Artifact transitions to `status: "published"` in Convex with `publishedAt` timestamp
- [ ] Article appears on microsite at `/articles/[slug]` — rendered by querying `api.artifacts.getBySlug` (NOT from hardcoded array)
- [ ] Hardcoded seed articles still render correctly at their existing slugs
- [ ] GitHub commit created as secondary distribution (backup/SEO)
- [ ] Typefully draft created with article slug as tag
- [ ] `approvalLog` table has entries: "submitted", "approved", "published"
- [ ] Full audit trail queryable: given an artifact ID, retrieve complete approval history

### Expected outcomes

**What the user sees**: A new article appears on `/articles` page after approval. Existing seed articles remain unchanged. The article content is grounded in RC docs.

**What is stored in Convex**: `artifacts` row with `status: "published"`, `publishedAt`, `qualityScores`, `approvalState: "approved"`, `githubCommitSha`, `typefullyDraftIds`. `approvalLog` rows tracking the full lifecycle.

### Files touched

| File | Action |
| --- | --- |
| `convex/schema.ts` | Edit: add approval fields to `artifacts`, add `approvalLog` table |
| `convex/artifacts.ts` | Edit: add `listPublished` query, `getBySlug` query, `approve` mutation |
| `convex/approvalLog.ts` | New: queries and mutations for approval log |
| `convex/http.ts` | Edit: add endpoints for approval-log, artifacts/approve |
| `app/(public)/articles/page.tsx` | Edit: merge Convex-fetched published articles with hardcoded seed articles |
| `app/(public)/articles/[slug]/page.tsx` | Edit: check Convex for dynamic articles if slug not in seed data |
| `inngest/functions.ts` | Edit: update `generateContent` to store draft in Convex, check review mode, post to Slack, emit publish event |
| `inngest/publish-content.ts` | New: content publishing function (Convex PRIMARY, GitHub + Typefully SECONDARY) |
| `inngest/slack-handler.ts` | Edit: add `handleSlackReaction` function |
| `app/api/slack/events/route.ts` | Edit: handle `reaction_added` events |
| `app/api/inngest/route.ts` | Edit: register new Inngest functions |
| `.env.example` | Already has `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `GITHUB_TOKEN`, `TYPEFULLY_API_KEY` |

### Environment variables needed

| Variable | Purpose | Status |
| --- | --- | --- |
| `SLACK_BOT_TOKEN` | Post approval messages, read reactions | Need to configure Slack app |
| `SLACK_SIGNING_SECRET` | Verify Slack webhook events | Need to configure Slack app |
| `SLACK_DEFAULT_CHANNEL` | Channel for approval posts | Need to set (default: "growthcat") |
| `GITHUB_TOKEN` | Commit markdown to repo (secondary) | Need to create token |
| `TYPEFULLY_API_KEY` | Create social drafts (secondary) | Need to set up Typefully account |
| `TYPEFULLY_SOCIAL_SET_ID` | Which social accounts to post to | Need to configure |

---

## VS-B2: The Loop Works

**Goal**: Run a complete Monday-Friday cycle with real output. Every pipeline fires, every piece of data flows into Convex.

**Dependencies**: VS-B1 (content pipeline with approval flow), all API keys configured

### What gets built

#### 1. Monday planner upgrade

**File**: `inngest/functions.ts` — `weeklyPlanningRun` function

The existing function already fetches DataForSEO keywords, scores opportunities, and posts to Slack. Upgrade it to:
1. Query Convex for last week's performance (content published, experiments completed, what worked)
2. Use the Convex Agent brain to analyze performance + new keyword data + community signals → select topics
3. Post the plan to Slack with topic options — RC can reply to adjust
4. Emit exactly **2** `growthcat/content.generate` events (2 content pieces per PRD requirement)
5. Emit exactly **3** `growthcat/feedback.generate` events — one per feedback topic (3 feedback items per PRD requirement, NOT 1 event that generates 3 items)
6. Emit **1** `growthcat/community.engage` event

**Why 3 separate feedback events**: The PRD requires 3+ structured product feedback items per week. Each feedback event generates one focused feedback item with its own evidence chain and GitHub Issue. Batching all 3 into one event loses the ability to track, retry, and audit each individually.

#### 2. Slack override for Monday plan

**File**: `inngest/slack-handler.ts`

When RC replies to the Monday plan message in Slack (not just reactions — actual text replies), parse the reply:
- "skip [topic]" → remove that topic from the week's plan
- "add [topic]" → add a new topic
- "focus on [topic]" → replace lowest-scored topic with this one (already partially implemented)
- Any other reply → pass to the Convex Agent brain for a natural language response

#### 3. Feedback pipeline upgrade

**File**: `inngest/functions.ts` — `generateFeedback` function

The existing function generates feedback via LLM. Upgrade it to:
1. Use RAG context (from VS-A1) to ground feedback in actual RC docs/SDK issues
2. After generating structured feedback, call `lib/feedback/file-issue.ts` `fileFeedbackIssue` to create a GitHub Issue
3. Store the GitHub Issue URL in the feedback item's `metadata` field in Convex
4. Update feedback status from `"draft"` to `"filed"`

#### 4. Community monitor upgrade

**File**: `inngest/community-monitor.ts`

The existing function scans GitHub repos for agent-related issues. Upgrade it to:
1. After generating a reply via the community engage function, also store the reply URL (if posted) in the community interaction record
2. Track which issues have already been replied to (dedup via `targetUrl` in `communityInteractions` table — query before engaging)
3. Post community activity summary to Slack daily (not just as part of the weekly report)

#### 5. Friday report upgrade

**File**: `inngest/functions.ts` — `weeklyReportGeneration` function

The existing function gathers metrics from Convex and generates a report. Upgrade it to:
1. Query real Convex data: actual artifact count, experiment status, feedback items filed (with GitHub URLs), community interaction count and meaningful ratio
2. Include specific article titles and their quality gate scores
3. Include specific experiment names and current status
4. Include feedback items with their GitHub Issue links
5. Store the report in Convex `weeklyReports` table (already done)
6. Post to Slack (already done)

#### 6. Event chaining completeness

Verify all event chains fire correctly:

```
Monday 9am UTC (Convex cron triggers workflowRuns.triggerWeeklyPlan):
  → Inngest weeklyPlanningRun fires
  → Emits: 2x growthcat/content.generate
  → Emits: 3x growthcat/feedback.generate (one per topic — PRD requires 3+/week)
  → Emits: 1x growthcat/community.engage

Each growthcat/content.generate:
  → generateContent fires
  → Stores draft in Convex artifacts table
  → If gates pass + review mode: posts to Slack for approval
  → On approval: emits growthcat/content.publish
  → publishContent fires: Convex status → "published" (PRIMARY)
  → GitHub commit + Typefully draft (SECONDARY)

Each growthcat/feedback.generate:
  → generateFeedback fires (one focused feedback item)
  → Files GitHub Issue
  → Stores feedback in Convex

growthcat/community.engage:
  → communityEngage fires
  → Posts reply via Typefully (X) or GitHub comment
  → Stores interaction in Convex

Every 6 hours (Inngest cron):
  → communityMonitor fires
  → Scans RC GitHub repos for agent-related issues
  → Emits up to 5x growthcat/community.engage

Friday 5pm UTC (Convex cron triggers weeklyReports.generateReport):
  → Inngest weeklyReportGeneration fires
  → Gathers real metrics from Convex
  → Generates report via LLM
  → Posts to Slack
  → Stores in Convex

Daily 6am UTC (Convex cron triggers sources.auditFreshness):
  → Checks source staleness
  → Logs stale sources
```

### Demo

1. Trigger Monday planner manually (send `growthcat/weekly.planning` event in Inngest dashboard, or wait for Monday 9am UTC cron)
2. See plan posted to Slack with 2 content topics, 1 experiment, 3 feedback targets
3. See 2 content generation runs start in Inngest dashboard
4. See 3 feedback generation runs start (one per topic)
5. See 2 draft approval posts appear in Slack
6. Approve both by reacting with thumbs up
7. See both articles publish: `status: "published"` in Convex → visible on `/articles` page
8. See 3 feedback items appear as GitHub Issues
9. See community interactions tracked in Convex
10. Trigger Friday report (send event or wait for Friday 5pm UTC)
11. See report in Slack with real numbers: "2 articles published, 1 experiment running, 3 feedback items filed, X community interactions"

### Exit criteria

- [ ] Monday: 1 plan posted to Slack with 2 scored content topics from DataForSEO
- [ ] Monday: Planner emits 3 separate `growthcat/feedback.generate` events (one per topic), not 1 batched event
- [ ] Tue-Thu: 2 content pieces through full pipeline (generate with RAG → draft in Convex → quality gates → Slack approval → `status: "published"` in Convex → visible on `/articles` → GitHub commit + Typefully)
- [ ] Tue-Thu: 3 feedback items in Convex, each filed as a separate GitHub Issue with URL stored in `metadata`
- [ ] Tue-Thu: 10+ community interactions tracked in Convex `communityInteractions` table (VS-B2 demonstrates the pipeline; full 50+/week target is achieved through ongoing operation across all channels)
- [ ] Friday: 1 report posted to Slack with real metric counts from Convex
- [ ] Friday: Report stored in Convex `weeklyReports` table with real data (not sample data)
- [ ] All Inngest functions complete without error (check Inngest dashboard)
- [ ] All event chains fire: planning → content.generate → content.publish, planning → feedback.generate (x3), monitor → community.engage

### Expected outcomes

**What the user sees**: A complete Monday-to-Friday cycle. Plan in Slack Monday, articles appearing on the site Tue-Thu, feedback filed as GitHub Issues, weekly report in Slack Friday.

**What is stored in Convex**: 2+ published artifacts, 3+ feedback items, 10+ community interactions, 1 weekly report, workflow run records for every function execution.

### Files touched

| File | Action |
| --- | --- |
| `inngest/functions.ts` | Edit: upgrade `weeklyPlanningRun` (emit 3x feedback events), `generateContent`, `generateFeedback`, `weeklyReportGeneration` |
| `inngest/publish-content.ts` | Exists from VS-B1: verify it works end-to-end |
| `inngest/community-monitor.ts` | Edit: add dedup check, daily summary |
| `inngest/slack-handler.ts` | Edit: handle plan override replies |
| `app/api/inngest/route.ts` | Edit: register any new functions |
| `convex/crons.ts` | Verify: Monday planning and Friday report crons work |
| `convex/weeklyReports.ts` | Verify: `generateReport` internal mutation produces real data |

---

## VS-B3: The Dashboard Works

**Goal**: Every operator page shows real data from Convex, not hardcoded samples. Real-time updates.

**Dependencies**: VS-B2 (real data in Convex from the weekly cycle), Convex deployed

### What gets built

#### 1. Wire all 7 operator pages to real Convex data

Each operator page currently uses `useConvexQuery` with a fallback to `SAMPLE_*` constants. After VS-B2, there is real data in Convex. The work here is to verify the queries return the right shape and remove sample data fallbacks one by one.

**File**: `app/(operator)/dashboard/page.tsx`
- Replace `SAMPLE_CONNECTORS` with a query to check which connectors are configured (derive from env var availability or from Convex status checks)
- Replace `SAMPLE_RUNS` with `useConvexQuery(convexApi?.workflowRuns?.list, { limit: 10 })`
- Replace `SAMPLE_TASK_QUEUE` with current pending workflow runs
- Add: last workflow run timestamp, connector health

**File**: `app/(operator)/pipeline/page.tsx`
- Replace `SAMPLE_SLOTS` with `useConvexQuery(convexApi?.artifacts?.list, {})`
- Map artifact `status` to pipeline stages: `"draft"` → Draft, `"validating"` → Quality Gates, `"validated"` → Approved, `"published"` → Published
- Replace `SAMPLE_DERIVATIVES` with artifacts where `artifactType` is `"social_post"` or `"x_thread"`
- Replace `SAMPLE_OPPORTUNITIES` with `useConvexQuery(convexApi?.opportunities?.getTopOverall, { limit: 10 })`
- Show `approvalState` and `qualityScores` per artifact

**File**: `app/(operator)/community/page.tsx`
- Replace sample data with `useConvexQuery(convexApi?.community?.list, {})`
- Show `qualityScore` and `meaningful` flag per interaction
- Show stats from `useConvexQuery(convexApi?.community?.getStats)`

**File**: `app/(operator)/experiments/page.tsx`
- Replace sample data with `useConvexQuery(convexApi?.experiments?.list, {})`
- Show experiment lifecycle: `"planned"` → `"running"` → `"measuring"` → `"completed"`
- Show `hypothesis`, `baselineMetric`, `targetMetric`, `results`

**File**: `app/(operator)/feedback/page.tsx`
- Replace sample data with `useConvexQuery(convexApi?.feedbackItems?.list, {})`
- Show feedback status: `"draft"` → `"filed"` → `"acknowledged"`
- Show GitHub Issue URL from `metadata` field

**File**: `app/(operator)/report/page.tsx`
- Replace sample data with `useConvexQuery(convexApi?.weeklyReports?.getLatest)`
- Show real weekly metrics and LLM-generated report content
- Archive: list past reports with `useConvexQuery(convexApi?.weeklyReports?.getByWeek, { weekNumber })`

#### 2. Real-time updates verification

All operator pages use `useConvexQuery` which returns reactive data from Convex. When new data is written (a new artifact, a new experiment), the page updates automatically without refresh. Verify this works end-to-end:
1. Open `/pipeline` in one tab
2. Trigger content generation in another tab
3. See the new draft appear in the pipeline page without refreshing

### Demo

1. Open `/dashboard` — see real workflow run history, connector status
2. Open `/pipeline` — see articles from VS-B2 with their quality gate scores and approval status
3. Open `/community` — see real interaction counts by channel
4. Open `/experiments` — see experiment records
5. Open `/feedback` — see feedback items with GitHub Issue links
6. Open `/report` — see the Friday report with real metrics
7. Trigger a new content generation — see the pipeline page update in real-time without refresh

### Exit criteria

- [ ] Zero hardcoded `SAMPLE_*` data used when Convex is connected (fallback only when `NEXT_PUBLIC_CONVEX_URL` is unset)
- [ ] `/dashboard` shows real workflow run data from `workflowRuns` table
- [ ] `/pipeline` shows real artifacts with `status`, `approvalState`, `qualityScores`
- [ ] `/community` shows real interactions from `communityInteractions` table
- [ ] `/experiments` shows real experiment records from `experiments` table
- [ ] `/feedback` shows real feedback items from `feedbackItems` table with GitHub Issue URLs
- [ ] `/report` shows real weekly report from `weeklyReports` table
- [ ] Real-time updates: new data appears without page refresh (test: trigger content generation while `/pipeline` is open)

### Expected outcomes

**What the user sees**: Every operator page shows real data. Pages update in real-time as new data flows in.

**What is stored in Convex**: No new data — this slice reads existing data from VS-B2.

### Files touched

| File | Action |
| --- | --- |
| `app/(operator)/dashboard/page.tsx` | Edit: replace sample data with Convex queries |
| `app/(operator)/pipeline/page.tsx` | Edit: replace sample data with Convex queries |
| `app/(operator)/community/page.tsx` | Edit: replace sample data with Convex queries |
| `app/(operator)/experiments/page.tsx` | Edit: replace sample data with Convex queries |
| `app/(operator)/feedback/page.tsx` | Edit: replace sample data with Convex queries |
| `app/(operator)/report/page.tsx` | Edit: replace sample data with Convex queries |

---

## VS-B4: The Experiment Works

**Goal**: Run one real growth experiment with before/after measurement using DataForSEO.

**Dependencies**: VS-B2 (content published and indexed), DataForSEO credentials configured

### What gets built

#### 1. Experiment runner Inngest function

**New file**: `inngest/experiment-runner.ts`

Triggered by `growthcat/experiment.run` event. Steps:

1. **Design**: receive hypothesis, target keyword, content slug from planner
2. **Baseline**: fetch current DataForSEO data for the target keyword:
   - SERP position for the target domain (if ranking)
   - Keyword difficulty
   - Search volume
   - Top 10 results (who currently ranks)
   - AI mentions for "revenuecat" (if DataForSEO AI Optimization is available)
3. **Store baseline**: update experiment record in Convex with baseline data
4. **Schedule measurement**: use Inngest `step.sleepUntil()` or `step.sleep("7d")` to wait 7 days
5. **Measure**: after 7 days, fetch the same DataForSEO data again
6. **Compare**: calculate deltas (position change, new ranking, traffic estimate change)
7. **Report**: post results to Slack, update experiment record in Convex with results

```typescript
// inngest/experiment-runner.ts — key structure

export const runExperiment = inngest.createFunction(
  { id: "experiment-runner", name: "Run Growth Experiment" },
  { event: "growthcat/experiment.run" },
  async ({ event, step }) => {
    const { experimentKey, hypothesis, targetKeyword, contentSlug } = event.data;

    // Step 1: Fetch baseline from DataForSEO
    const baseline = await step.run("fetch-baseline", async () => {
      const login = process.env.DATAFORSEO_LOGIN;
      const password = process.env.DATAFORSEO_PASSWORD;
      if (!login || !password) return { source: "unavailable" };

      // SERP check for target keyword
      const serpRes = await fetch(
        "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${login}:${password}`)}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([{
            keyword: targetKeyword,
            location_code: 2840,
            language_code: "en",
            depth: 20,
          }]),
        }
      );
      const serpData = await serpRes.json();
      // ... parse results, find our domain's position (or "not ranking")
      return { serpPosition, topResults, volume, difficulty };
    });

    // Step 2: Store baseline
    await step.run("store-baseline", async () => {
      await convexStore("/api/experiments", {
        experimentKey,
        title: `Experiment: ${targetKeyword}`,
        hypothesis,
        baselineMetric: JSON.stringify(baseline),
        targetMetric: "SERP position improvement",
        status: "running",
        startedAt: Date.now(),
      });
    });

    // Step 3: Wait 7 days for indexing
    await step.sleep("wait-for-indexing", "7d");

    // Step 4: Measure again
    const measurement = await step.run("measure", async () => {
      // Same DataForSEO call as baseline
      // ... return { serpPosition, topResults, volume, difficulty }
    });

    // Step 5: Compare and report
    const results = await step.run("compare", async () => {
      const delta = {
        positionBefore: baseline.serpPosition ?? "not ranking",
        positionAfter: measurement.serpPosition ?? "not ranking",
        // ... more deltas
      };
      return delta;
    });

    // Step 6: Post to Slack and store results
    await step.run("report-results", async () => {
      // Post to Slack
      // Update experiment in Convex: status "completed", results
    });
  }
);
```

#### 2. Experiment lifecycle in Convex

**File**: `convex/experiments.ts`

Add mutations for updating experiment status and results:
- `start`: set status to "running", store baseline
- `complete`: set status to "completed", store results and completedAt
- `stop`: set status to "stopped" (experiment abandoned)

Experiment states: `"planned"` → `"running"` (with baseline) → `"measuring"` (waiting for 7-day check) → `"completed"` (with results) or `"stopped"`

#### 3. Planner emits experiment event

**File**: `inngest/functions.ts` — `weeklyPlanningRun`

After selecting content topics, also emit a `growthcat/experiment.run` event for the third-ranked keyword:

```typescript
await step.sendEvent("trigger-experiment", {
  name: "growthcat/experiment.run",
  data: {
    experimentKey: `exp-${weekNumber}-${plan.experimentTopic.replace(/\s+/g, "-")}`,
    hypothesis: `Publishing a targeted article for "${plan.experimentTopic}" will result in indexing within 7 days`,
    targetKeyword: plan.experimentTopic,
    contentSlug: plan.experimentTopic.replace(/\s+/g, "-"),
  },
});
```

### Demo

1. Agent publishes article targeting "revenuecat webhook"
2. Experiment runner fetches DataForSEO baseline: not ranking for "revenuecat webhook"
3. Experiment record in Convex shows: status "running", baseline data stored
4. 7 days later (or triggered manually for demo): DataForSEO check runs again
5. Results posted to Slack: "Article indexed, position X for 'revenuecat webhook'. Baseline: not ranking. Delta: +X positions."
6. `/experiments` page shows the experiment with baseline, measurement, and delta

### Exit criteria

- [ ] One experiment record in Convex with real DataForSEO baseline data (SERP position, keyword difficulty, search volume)
- [ ] Experiment status transitions: `"planned"` → `"running"` → `"measuring"` (after 7-day sleep) → `"completed"`
- [ ] Baseline stored in `experiments.baselineMetric` as structured JSON
- [ ] Measurement scheduled (Inngest `step.sleep("7d")` — visible in Inngest dashboard as a sleeping function)
- [ ] `/experiments` page shows the live experiment with real baseline data
- [ ] Slack notification sent when experiment completes (even if result is "still not ranking")

### Expected outcomes

**What the user sees**: Experiment dashboard shows a running experiment with real DataForSEO baseline data. After 7 days, results appear with before/after comparison.

**What is stored in Convex**: `experiments` row with `baselineMetric` (JSON with SERP data), `status`, `startedAt`, and eventually `results` and `completedAt`.

### Files touched

| File | Action |
| --- | --- |
| `inngest/experiment-runner.ts` | New: experiment lifecycle function |
| `inngest/functions.ts` | Edit: planner emits `growthcat/experiment.run` event |
| `app/api/inngest/route.ts` | Edit: register `runExperiment` function |
| `convex/experiments.ts` | Edit: add `start`, `complete`, `stop` mutations |
| `convex/http.ts` | Edit: add PUT endpoint for experiment updates (or use existing POST) |

### Environment variables needed

| Variable | Purpose | Status |
| --- | --- | --- |
| `DATAFORSEO_LOGIN` | DataForSEO API auth | Need to set |
| `DATAFORSEO_PASSWORD` | DataForSEO API auth | Need to set |

---

## VS-B5: The Onboarding Works

**Goal**: Onboarding page securely stores RC secrets server-side. `agentConfig` stores only non-secret preferences. Secrets are never readable from client code.

**Dependencies**: Convex deployed

### Critical fix: server-only secret handling

The previous design stored RC secrets (Slack bot token, CMS API key, Charts API key) in the Convex `agentConfig` table, which is readable by any client query. This is a security violation.

**The fix**:
- **Secrets** (API tokens, bot tokens) are stored via **Convex environment variables** (`npx convex env set`) or in a server-only mechanism. They are accessed only from Convex actions and Inngest functions (server-side), never from queries or the client.
- **Preferences** (review mode, focus topics, report channel name, enabled platforms) are stored in the Convex `agentConfig` table — these are non-secret and safe to read from the client.

### What gets built

#### 1. New Convex table: `agentConfig` (preferences only, NO secrets)

**File**: `convex/schema.ts`

```typescript
agentConfig: defineTable({
  reviewMode: v.string(),          // "draft_only" | "auto_publish"
  focusTopics: v.array(v.string()),
  slackChannel: v.optional(v.string()),  // channel NAME (not token)
  githubOrg: v.optional(v.string()),     // org name (not token)
  enabledPlatforms: v.optional(v.array(v.string())), // ["slack", "cms", "charts"]
  paused: v.boolean(),             // kill switch
  updatedAt: v.number(),
}),
```

**REMOVED from agentConfig**: `slackBotToken`, `cmsApiKey`, `chartsApiKey` — these are secrets and must NOT be in a client-readable table.

#### 2. Convex HTTP action for secret storage

**New file**: `convex/onboarding.ts`

The onboarding page calls a Convex HTTP action (NOT a client-callable mutation) that stores secrets server-side:

```typescript
// convex/onboarding.ts

import { httpAction } from "./_generated/server";

// HTTP action — only accessible via authenticated HTTP endpoint, not client queries
export const storeSecret = httpAction(async (ctx, request) => {
  // Verify request auth (GROWTHCAT_INTERNAL_SECRET)
  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${process.env.GROWTHCAT_INTERNAL_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { key, value } = await request.json();
  // Store as Convex environment variable via admin API
  // OR store in a server-only table that has no client-facing queries
  //
  // Option A: Use process.env (set via npx convex env set)
  // Option B: Store in a server-only table with only internal queries
  //
  // Either way, the value is never exposed to client-side code.

  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
```

#### 3. Onboarding page persistence

**File**: `app/(operator)/onboarding/page.tsx`

Wire the existing onboarding UI to:
1. **Secrets** (Slack token, CMS key, Charts key): Send to a Next.js API route (`/api/onboarding/secrets`) which forwards to the Convex HTTP action. The client never stores or reads the actual secret value.
2. **Preferences** (review mode, focus topics, channel name): Save to the `agentConfig` table via a standard Convex mutation. These are non-secret and safe for client access.
3. Show connection status by checking which platforms are in `agentConfig.enabledPlatforms` (not by checking if a secret key exists — that would expose its presence).

**New file**: `app/api/onboarding/secrets/route.ts`

```typescript
// Next.js API route that forwards secrets to Convex HTTP action
export async function POST(req: Request) {
  const { secretName, secretValue } = await req.json();

  // Forward to Convex HTTP action (server-to-server, authenticated)
  const res = await fetch(`${process.env.NEXT_PUBLIC_CONVEX_URL}/api/onboarding/store-secret`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROWTHCAT_INTERNAL_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ key: secretName, value: secretValue }),
  });

  return new Response(JSON.stringify({ success: res.ok }), { status: res.status });
}
```

#### 4. Convex agentConfig queries and mutations

**New file**: `convex/agentConfig.ts`

```typescript
// convex/agentConfig.ts — NON-SECRET preferences only

export const get = query({
  args: {},
  handler: async (ctx) => {
    // Return the singleton config (first row)
    return await ctx.db.query("agentConfig").first();
  },
});

export const save = mutation({
  args: {
    reviewMode: v.string(),
    focusTopics: v.array(v.string()),
    slackChannel: v.optional(v.string()),
    githubOrg: v.optional(v.string()),
    enabledPlatforms: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("agentConfig").first();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("agentConfig", {
        ...args,
        paused: false,
        updatedAt: Date.now(),
      });
    }
  },
});

export const setPaused = mutation({
  args: { paused: v.boolean() },
  handler: async (ctx, { paused }) => {
    const existing = await ctx.db.query("agentConfig").first();
    if (existing) {
      await ctx.db.patch(existing._id, { paused, updatedAt: Date.now() });
    }
  },
});
```

### How secrets are accessed at runtime

Convex actions and Inngest functions access secrets via `process.env`:

```typescript
// In any Convex action or Inngest function:
const slackToken = process.env.SLACK_BOT_TOKEN;    // Set via npx convex env set
const cmsKey = process.env.CMS_API_KEY;            // Set via npx convex env set
const chartsKey = process.env.CHARTS_API_KEY;      // Set via npx convex env set
```

The onboarding flow either:
1. Sets these via the Convex admin API (programmatic `npx convex env set` equivalent)
2. Or instructs the operator to run `npx convex env set SLACK_BOT_TOKEN <value>` manually

Either way, secrets live in server-side environment variables, not in the database.

### Demo

1. Open `/onboarding`
2. Enter CMS API key → see "Connected" badge (the key is sent server-side, never stored in client state)
3. Set review mode to "draft_only" → see it reflected in `agentConfig` table
4. Set focus topics → see them stored in `agentConfig`
5. Verify: open browser DevTools → Network tab → no API call ever returns the CMS API key
6. Verify: `useConvexQuery(api.agentConfig.get)` returns `{ reviewMode, focusTopics, slackChannel, ... }` but NO secret fields

### Exit criteria

- [ ] `agentConfig` table contains ONLY non-secret fields: `reviewMode`, `focusTopics`, `slackChannel` (name), `githubOrg` (name), `enabledPlatforms`, `paused`, `updatedAt`
- [ ] `agentConfig` table does NOT contain: `slackBotToken`, `cmsApiKey`, `chartsApiKey`
- [ ] Secrets are stored via Convex environment variables (server-side only)
- [ ] Onboarding page sends secrets to a server-side endpoint (Next.js API route → Convex HTTP action), never to a client-callable mutation
- [ ] `useConvexQuery(api.agentConfig.get)` returns preferences only — no secret values anywhere in the response
- [ ] Review mode selection works: changing to "draft_only" causes next content generation to post to Slack for approval
- [ ] Kill switch: `@GrowthCat stop` in Slack sets `agentConfig.paused = true`

### Expected outcomes

**What the user sees**: Onboarding wizard with 4 steps. Secrets are entered once and confirmed with a "Connected" badge. Preferences are editable. No secret values visible in the UI or in network requests.

**What is stored in Convex**: `agentConfig` row with non-secret preferences only. Secrets stored as Convex environment variables (not in any table).

### Files touched

| File | Action |
| --- | --- |
| `convex/schema.ts` | Edit: add `agentConfig` table (NO secret fields) |
| `convex/agentConfig.ts` | New: queries and mutations for non-secret preferences |
| `convex/onboarding.ts` | New: HTTP action for server-side secret storage |
| `convex/http.ts` | Edit: register onboarding HTTP action |
| `app/(operator)/onboarding/page.tsx` | Edit: wire form to Convex mutations (preferences) and API route (secrets) |
| `app/api/onboarding/secrets/route.ts` | New: Next.js API route for forwarding secrets to Convex |

---

## Approval / Human-in-the-Loop Model

### Trust Ramp

GrowthCat starts with maximum human oversight and earns autonomy through demonstrated quality:

| Phase | Review Mode | When | What happens |
| --- | --- | --- | --- |
| 1. Draft Only | `draft_only` | First 2 weeks | Every content piece posted to Slack for explicit approval before publishing. RC reacts with thumbs up or replies with feedback. |
| 2. Semi-Autonomous | `auto_publish` with notifications | Weeks 3-4 | Quality gates auto-approve if all 8 pass. RC gets Slack notification of every publish with a 1-hour override window. |
| 3. Bounded Autonomy | `auto_publish` | Month 2+ | Quality gates are the only gate. RC gets weekly summary of all published content. Override available anytime via `@GrowthCat stop`. |

### Slack Approval Workflow (Phase 1)

```
1. Content generated with RAG grounding
2. 8 quality gates run:
   - Grounding: every claim maps to a cited source
   - Novelty: not a duplicate (checked via Convex text search)
   - Technical: code samples valid, API refs correct
   - SEO: title, meta, headings, keyword targeting
   - AEO: extractable answer passages, FAQ blocks
   - GEO: comparison tables, schema markup, citations
   - Benchmark: stronger than existing alternatives
   - Voice: consistent with GrowthCat voice profile

3a. ALL blocking gates pass:
   → Post to Slack: "Draft ready: [title]
     Quality gates: 8/8 passed
     Word count: [N]
     Target keyword: [keyword]
     React with thumbs up to approve, or reply with feedback."
   → Set artifact.approvalState = "pending"
   → Log "submitted" in approvalLog

4a. RC reacts with thumbs up:
   → Set artifact.approvalState = "approved"
   → Log "approved" in approvalLog (actor: RC user ID)
   → Set artifact.status = "published" in Convex (PRIMARY — appears on site)
   → Commit to GitHub (SECONDARY — backup/SEO)
   → Create Typefully draft (SECONDARY — distribution)
   → Log "published" in approvalLog

4b. RC replies with feedback text:
   → Set artifact.approvalState = "rejected"
   → Log "rejected" in approvalLog (reason: RC's feedback text)
   → Re-generate content incorporating feedback
   → Re-run quality gates
   → Re-post to Slack for approval

3b. Any blocking gate FAILS:
   → Set artifact.status = "rejected"
   → Post to Slack: "Draft blocked: [title]
     Failed gate: [gate name]
     Reason: [reason]"
   → Log "rejected" in approvalLog (reason: gate failure)
```

### Override Logging

Every approval action is logged in the `approvalLog` table with:
- `artifactId`: which content piece
- `action`: what happened ("submitted", "approved", "rejected", "auto_approved", "override", "paused")
- `actor`: who did it (Slack user ID or "system" for auto-actions)
- `reason`: why (gate failure text, RC feedback text, or null for approvals)
- `timestamp`: when

### Kill Switch

`@GrowthCat stop` in Slack sets `agentConfig.paused = true`. When paused:
- All Inngest functions check the paused flag at the start and exit immediately if true
- No new content is generated, published, or distributed
- No new community interactions are posted
- Existing sleeping functions (experiment measurements) continue to sleep but will check the flag before executing
- `@GrowthCat resume` clears the flag

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Next.js 15 (App Router)                         │
│                                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │
│  │ Public    │  │ Operator │  │ API      │  │ Components           │   │
│  │ Pages    │  │ Console  │  │ Routes   │  │                      │   │
│  │          │  │          │  │          │  │ Chat.tsx              │   │
│  │ /        │  │ /dash    │  │ /chat    │  │ ChatWidget.tsx        │   │
│  │ /app     │  │ /pipe    │  │ /panel   │  │                      │   │
│  │ /proof   │  │ /comm    │  │ /slack   │  │                      │   │
│  │ /articles│  │ /exp     │  │ /inngest │  │                      │   │
│  │ /review  │  │ /feed    │  │ /onboard │  │                      │   │
│  │ /replay  │  │ /report  │  │ /secrets │  │                      │   │
│  │          │  │ /onboard │  │          │  │                      │   │
│  │          │  │ /panel   │  │          │  │                      │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
        │                 │                │
        │                 │                │
        ▼                 ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    BRAIN: Convex Agent + Convex DB                      │
│                                                                         │
│  ┌─────────────────────┐  ┌──────────────────────────────────────────┐ │
│  │ Convex Agent         │  │ Convex Database                         │ │
│  │ (@convex-dev/agent)  │  │                                         │ │
│  │                      │  │ Tables:                                  │ │
│  │ - Thread management  │  │  artifacts, workflowRuns, experiments,  │ │
│  │ - Message persistence│  │  feedbackItems, opportunitySnapshots,   │ │
│  │ - Thread search      │  │  communityInteractions, weeklyReports,  │ │
│  │   (AUTOMATIC)        │  │  sources (+ vector index),              │ │
│  │ - Tool calling       │  │  agentConfig (prefs only),              │ │
│  │                      │  │  approvalLog                            │ │
│  │ Custom doc RAG       │  │                                         │ │
│  │   (EXPLICIT via      │  │ Env vars (server-only):                 │ │
│  │    contextHandler)   │  │  SLACK_BOT_TOKEN, CMS_API_KEY,         │ │
│  │                      │  │  CHARTS_API_KEY                         │ │
│  │ LLM: Claude Sonnet   │  │                                         │ │
│  │ Embed: OpenAI 3-small│  │ Indexes: regular, text search, vector  │ │
│  └─────────────────────┘  │ Crons: Mon plan, daily audit, Fri rpt  │ │
│                             │ HTTP: 10+ authenticated endpoints       │ │
│                             └──────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                HANDS: Inngest Orchestration + AgentKit                  │
│                                                                         │
│  Inngest Functions (durable, retryable, observable):                    │
│  ┌────────────┐ ┌────────────┐ ┌──────────────┐ ┌───────────────────┐ │
│  │ Weekly     │ │ Content    │ │ Content      │ │ Feedback          │ │
│  │ Planning   │ │ Generate   │ │ Publish      │ │ Generate          │ │
│  │ (Mon 9am)  │ │ (event)    │ │ (event)      │ │ (event x3)       │ │
│  └────────────┘ └────────────┘ └──────────────┘ └───────────────────┘ │
│  ┌────────────┐ ┌────────────┐ ┌──────────────┐ ┌───────────────────┐ │
│  │ Community  │ │ Community  │ │ Experiment   │ │ Weekly            │ │
│  │ Engage     │ │ Monitor    │ │ Runner       │ │ Report            │ │
│  │ (event)    │ │ (every 6h) │ │ (event)      │ │ (Fri 5pm)        │ │
│  └────────────┘ └────────────┘ └──────────────┘ └───────────────────┘ │
│  ┌────────────┐ ┌────────────┐ ┌──────────────┐ ┌───────────────────┐ │
│  │ Slack      │ │ Slack      │ │ Source       │ │ Knowledge         │ │
│  │ Command    │ │ Reaction   │ │ Freshness    │ │ Ingest            │ │
│  │ (event)    │ │ (event)    │ │ (daily 6am)  │ │ (event)           │ │
│  └────────────┘ └────────────┘ └──────────────┘ └───────────────────┘ │
│                                                                         │
│  AgentKit Network (5 agents, deterministic routing):                    │
│  planner → content → growth → feedback → community                     │
└─────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     CONNECTORS (native fetch)                           │
│                                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐│
│  │DataForSEO│ │  Slack   │ │Typefully │ │  GitHub  │ │  RevenueCat  ││
│  │          │ │          │ │          │ │          │ │              ││
│  │ Keywords │ │ Post msg │ │ Create   │ │ Commit   │ │ REST API v2  ││
│  │ SERP     │ │ Read rxn │ │ draft    │ │ Issue    │ │ Customers    ││
│  │ AI opt   │ │ Upload   │ │ Schedule │ │ Comment  │ │ Products     ││
│  │ Trends   │ │          │ │ Queue    │ │ Gist     │ │ Offerings    ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    QUALITY: Determinism + Gates                         │
│                                                                         │
│  8 Quality Gates:                                                       │
│  grounding → novelty → technical → seo → aeo → geo → benchmark → voice│
│                                                                         │
│  Dedup Keys:                                                            │
│  artifact:slug, interaction:targetUrl+channel, experiment:experimentKey │
│  feedback:title hash, report:weekNumber, opportunity:topic+lane         │
│                                                                         │
│  Content Lifecycle:                                                     │
│  planned → generating → draft → validating → validated → publishing    │
│  → published → measuring                                               │
│                                                                         │
│  Publishing:                                                            │
│  PRIMARY: artifact.status → "published" in Convex (renders on site)    │
│  SECONDARY: GitHub commit (backup/SEO) + Typefully draft (distribution)│
│                                                                         │
│  Security:                                                              │
│  Bearer auth (Convex HTTP), HMAC-SHA256 (Slack), Token (Panel),        │
│  SDK signing (Inngest), fail-closed on all endpoints                   │
│  Secrets: Convex env vars (server-only, NOT in agentConfig table)      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Convex Schema (Complete)

The complete Convex schema after all vertical slices are implemented. This is the target state.

```typescript
// convex/schema.ts — complete target schema

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ────────────────────────────────────────────────────────────
  // Content artifacts (blog posts, tutorials, reports, feedback)
  // ────────────────────────────────────────────────────────────
  artifacts: defineTable({
    artifactType: v.string(),        // "blog_post" | "tutorial" | "social_post" | "report" | "feedback"
    title: v.string(),
    slug: v.string(),                // unique, URL-safe
    content: v.string(),             // markdown
    contentFormat: v.string(),       // "markdown"
    status: v.string(),              // "planned" | "generating" | "draft" | "validating" | "validated" | "rejected" | "publishing" | "published" | "measuring"
    metadata: v.optional(v.any()),
    qualityScores: v.optional(v.any()),  // array of { gate, passed, reason, blocking }
    llmProvider: v.optional(v.string()),
    llmModel: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    // Approval tracking (VS-B1)
    approvalState: v.optional(v.string()),   // "pending" | "approved" | "rejected" | "auto"
    approvedBy: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
    reviewMode: v.optional(v.string()),
    slackThreadTs: v.optional(v.string()),
    typefullyDraftIds: v.optional(v.any()),
    githubCommitSha: v.optional(v.string()),
  })
    .index("by_type_status", ["artifactType", "status"])
    .index("by_slug", ["slug"])
    .index("by_approval", ["approvalState"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["artifactType"],
    }),

  // ────────────────────────────────────────────────────────────
  // Inngest function execution tracking
  // ────────────────────────────────────────────────────────────
  workflowRuns: defineTable({
    workflowType: v.string(),
    status: v.string(),              // "pending" | "running" | "completed" | "failed"
    inputParams: v.optional(v.any()),
    outputSummary: v.optional(v.any()),
    completedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  }).index("by_type_status", ["workflowType", "status"]),

  // ────────────────────────────────────────────────────────────
  // Growth experiments with hypothesis and measurement
  // ────────────────────────────────────────────────────────────
  experiments: defineTable({
    experimentKey: v.string(),       // unique, e.g. "exp-w12-revenuecat-webhook"
    title: v.string(),
    hypothesis: v.string(),
    baselineMetric: v.string(),      // JSON: { serpPosition, volume, difficulty }
    targetMetric: v.string(),
    status: v.string(),              // "planned" | "running" | "measuring" | "completed" | "stopped"
    results: v.optional(v.any()),    // JSON: { positionBefore, positionAfter, delta }
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  }).index("by_status", ["status"]),

  // ────────────────────────────────────────────────────────────
  // Structured product feedback items
  // ────────────────────────────────────────────────────────────
  feedbackItems: defineTable({
    title: v.string(),
    problem: v.string(),
    evidence: v.optional(v.string()),
    proposedFix: v.optional(v.string()),
    sourceLane: v.optional(v.string()),
    status: v.string(),              // "draft" | "filed" | "acknowledged"
    metadata: v.optional(v.any()),   // { severity, githubIssueUrl, generatedTokens }
  }).index("by_status", ["status"]),

  // ────────────────────────────────────────────────────────────
  // Scored growth opportunities from DataForSEO + community
  // ────────────────────────────────────────────────────────────
  opportunitySnapshots: defineTable({
    slug: v.string(),
    title: v.string(),
    lane: v.string(),                // "flagship_searchable" | "flagship_shareable" | "experiment" | etc.
    audience: v.optional(v.string()),
    score: v.number(),               // 0-1
    components: v.optional(v.any()), // { difficulty, volume, ... }
    rationale: v.optional(v.string()),
    readinessScore: v.optional(v.number()),
    readinessPasses: v.boolean(),
    workflowRunId: v.optional(v.id("workflowRuns")),
  }).index("by_lane_score", ["lane", "score"]),

  // ────────────────────────────────────────────────────────────
  // Community engagement tracking
  // ────────────────────────────────────────────────────────────
  communityInteractions: defineTable({
    channel: v.string(),             // "github" | "x" | "discord" | "stackoverflow"
    interactionType: v.string(),     // "reply" | "post" | "gist" | "comment"
    content: v.string(),
    targetUrl: v.optional(v.string()),
    qualityScore: v.optional(v.number()),
    meaningful: v.boolean(),
  })
    .index("by_channel", ["channel"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["channel"],
    }),

  // ────────────────────────────────────────────────────────────
  // Weekly aggregated reports
  // ────────────────────────────────────────────────────────────
  weeklyReports: defineTable({
    weekNumber: v.number(),
    contentCount: v.number(),
    experimentCount: v.number(),
    feedbackCount: v.number(),
    interactionCount: v.number(),
    reportContent: v.string(),       // LLM-generated markdown
    slackTs: v.optional(v.string()),
  }).index("by_week", ["weekNumber"]),

  // ────────────────────────────────────────────────────────────
  // Knowledge base with embeddings for RAG (VS-A1)
  // ────────────────────────────────────────────────────────────
  sources: defineTable({
    key: v.string(),                 // "revenuecat_docs:webhooks:chunk:3"
    url: v.optional(v.string()),
    provider: v.string(),            // "RevenueCat" | "DataForSEO" | "GitHub"
    sourceClass: v.string(),         // "public_product" | "market_intelligence"
    evidenceTier: v.string(),
    lastRefreshed: v.number(),
    contentHash: v.string(),         // SHA-256 of chunk text (dedup)
    summary: v.optional(v.string()),
    chunkText: v.string(),           // (VS-A1): the actual text chunk
    chunkIndex: v.optional(v.number()), // (VS-A1): position within source
    embedding: v.array(v.float64()), // (VS-A1): 1536-dim vector
  })
    .index("by_provider", ["provider"])
    .index("by_key", ["key"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["provider", "sourceClass"],
    }),

  // ────────────────────────────────────────────────────────────
  // Agent configuration (VS-B5) — NON-SECRET preferences only
  // Secrets (tokens, API keys) stored as Convex env vars, NOT here
  // ────────────────────────────────────────────────────────────
  agentConfig: defineTable({
    reviewMode: v.string(),          // "draft_only" | "auto_publish"
    focusTopics: v.array(v.string()),
    slackChannel: v.optional(v.string()),   // channel NAME (not token)
    githubOrg: v.optional(v.string()),      // org name (not token)
    enabledPlatforms: v.optional(v.array(v.string())), // ["slack", "cms", "charts"]
    paused: v.boolean(),
    updatedAt: v.number(),
  }),

  // ────────────────────────────────────────────────────────────
  // Approval audit log (VS-B1) — every approval/rejection/override
  // ────────────────────────────────────────────────────────────
  approvalLog: defineTable({
    artifactId: v.id("artifacts"),
    action: v.string(),              // "submitted" | "approved" | "rejected" | "auto_approved" | "override" | "paused"
    actor: v.optional(v.string()),   // Slack user ID or "system"
    reason: v.optional(v.string()),
    timestamp: v.number(),
  }).index("by_artifact", ["artifactId"]),
});
```

---

## Growth Levers

### Target Query Clusters (Data-Backed)

Based on DataForSEO keyword difficulty analysis (retrieved 2026-03-16):

| Priority | Keyword | Difficulty | Intent | Content type |
| --- | --- | --- | --- | --- |
| P0 | revenuecat react native | 2 | Informational | Integration guide |
| P0 | revenuecat flutter | 3 | Informational | Integration guide |
| P0 | revenuecat api | 13 | Informational | API reference for agents |
| P0 | revenuecat pricing | 14 | Commercial | Pricing breakdown |
| P1 | revenuecat entitlements | ~5 (est.) | Informational | Deep-dive guide |
| P1 | revenuecat offerings | ~5 (est.) | Informational | Configuration guide |
| P1 | revenuecat webhook | ~10 (est.) | Informational | Event handling guide |
| P1 | revenuecat tutorial | ~10 (est.) | Informational | Step-by-step tutorial |
| P1 | revenuecat vs adapty | ~15 (est.) | Commercial | Comparison page |
| P2 | mobile app monetization | 30 | Informational | Broad playbook |
| P2 | in-app purchase api | 37 | Informational | RC vs DIY comparison |
| P2 | subscription management api | 50 | Informational | Long-form guide |

### Content-Led Growth (Levers 1-7)

| # | Lever | Description | Frequency |
| --- | --- | --- | --- |
| 1 | Technical deep-dives | API walkthroughs, SDK patterns, architecture guides for agent builders | 1/week |
| 2 | Integration guides | "RevenueCat + [Framework]" for Cursor, Windsurf, Claude, GPT, etc. | 1/week |
| 3 | Code samples and demos | Working repos that developers can fork and use immediately | 2/month |
| 4 | Changelog commentary | Agent-perspective analysis of every RevenueCat release | Per release |
| 5 | Troubleshooting guides | Solutions to common agent-specific friction points | As discovered |
| 6 | Migration guides | "Moving from DIY subscriptions to RevenueCat" for agent apps | 1/month |
| 7 | RevenueCat Agent Cookbook | Collection of recipes for common agent + RC patterns | Ongoing |

### Community-Led Growth (Levers 8-13)

| # | Lever | Description | Frequency |
| --- | --- | --- | --- |
| 8 | X engagement | Threads, replies, quote tweets on agent monetization topics | 20+/week |
| 9 | GitHub issue triage | Answer agent-related questions on RevenueCat SDK repos | 10+/week |
| 10 | Discord presence | Active in agent builder communities (Cursor, Claude, etc.) | 10+/week |
| 11 | Stack Overflow | Canonical answers for RevenueCat questions | 5+/week |
| 12 | Community spotlight | Feature agent builders who use RC successfully | 2/month |
| 13 | Dev.to / Hashnode | Cross-post long-form content for wider reach | Per article |

### SEO/AEO/GEO-Led Growth (Levers 14-19)

| # | Lever | Description | Frequency |
| --- | --- | --- | --- |
| 14 | Long-tail keyword content | Target "revenuecat [modifier]" keywords from DataForSEO | Ongoing |
| 15 | Programmatic SEO | Auto-generated pages for every RC SDK + use case combination | Batch |
| 16 | FAQ hubs | Canonical answers structured for LLM citation (AEO) | Ongoing |
| 17 | Comparison pages | "RevenueCat vs [alternative]" for agent use cases | 3-5 total |
| 18 | AI mention monitoring | Track what ChatGPT, Perplexity, Claude say about RC (DataForSEO AI Optimization API) | Weekly |
| 19 | Schema markup | Structured data on all published pages for rich results | Per page |

### Developer Tooling Growth (Levers 20-24)

| # | Lever | Description | Frequency |
| --- | --- | --- | --- |
| 20 | Agent SDK wrapper | npm package: `@growthcat/revenuecat-agent` optimized for programmatic usage | Ship once, maintain |
| 21 | CLI tool | `npx growthcat-rc-setup` for bootstrapping agent + RC projects | Ship once |
| 22 | GitHub Actions | CI action for testing RC webhook handling | Ship once |
| 23 | Starter templates | Template repos for popular agent frameworks + RC | 3-5 templates |
| 24 | Playground | Interactive sandbox for testing RC API calls | Ship once |

### Product Feedback Growth (Levers 25-29)

| # | Lever | Description | Frequency |
| --- | --- | --- | --- |
| 25 | Structured feedback | Evidence-backed product improvement proposals | 3+/week |
| 26 | Agent onboarding path | Push for API-first quickstart in RC docs | Priority item |
| 27 | Charts API advocacy | Push for programmatic access to subscription metrics | Priority item |
| 28 | SDK DX improvements | Identify and propose fixes for agent-unfriendly patterns | Ongoing |
| 29 | Documentation PRs | Direct PRs to RC docs improving agent developer experience | 2+/month |

### Distribution and Amplification (Levers 30-33)

| # | Lever | Description | Frequency |
| --- | --- | --- | --- |
| 30 | Typefully multi-platform | Every content piece to X + LinkedIn + Threads + Bluesky simultaneously | Per artifact |
| 31 | Derivative content | Long-form to X thread + GitHub gist + short summary + Slack post | Per flagship |
| 32 | Optimal scheduling | Typefully `next-free-slot` for peak engagement times | Automatic |
| 33 | Content repurposing | Turn community answers into blog posts, blog posts into threads | Ongoing |

### Experiment-Driven Growth (Levers 34-38)

| # | Lever | Description | Frequency |
| --- | --- | --- | --- |
| 34 | Format A/B tests | Long-form guide vs. short code sample for engagement | 1/week |
| 35 | Channel comparison | X thread vs. GitHub gist vs. blog for developer reach | 1/month |
| 36 | Posting optimization | Time-of-day and day-of-week experiments via Typefully queue | Ongoing |
| 37 | Programmatic SEO test | Auto-generated integration pages for search traffic | 1/quarter |
| 38 | Social campaign | "Build a monetized app in 10 minutes" challenge | 1/quarter |

### Ecosystem and Partnership (Levers 39-42)

| # | Lever | Description | Frequency |
| --- | --- | --- | --- |
| 39 | Framework integrations | Official guides for RC + Cursor, Windsurf, Replit, etc. | 1/month |
| 40 | Co-marketing | Joint content with agent framework maintainers | 2/quarter |
| 41 | Conference talks | Operator presents with GrowthCat's research and content | As available |
| 42 | Podcast appearances | Operator discusses AI agents in app development | As available |

### Compounding Growth (Levers 43-48)

| # | Lever | Description | Frequency |
| --- | --- | --- | --- |
| 43 | Knowledge arbitrage | GrowthCat knows RC's docs better than any human; answers obscure questions instantly | Every interaction |
| 44 | Real-time community response | Respond to GitHub issues within minutes, not hours | Every 6h scan |
| 45 | Cross-platform content multiplication | One article becomes X thread + LinkedIn post + GitHub gist + Slack summary + community replies, all from one generation | Per flagship |
| 46 | Experiment compounding | Each experiment's results inform next week's strategy automatically | Weekly |
| 47 | Feedback pattern recognition | Aggregate feedback items to surface systemic issues, not one-off complaints | Weekly |
| 48 | Competitive intelligence | Monitor Adapty/Superwall/Qonversion docs for changes; create comparison content when they ship features | Weekly |

---

## Ownership Model

### Operator pays for (covered by RC's "dedicated budget for compute resources and API access")

| Service | Purpose | Est. monthly cost |
| --- | --- | --- |
| Anthropic API | LLM for chat, panel, content generation | ~$50-200 |
| OpenAI API | Embeddings (text-embedding-3-small) | ~$5-10 |
| DataForSEO | Keyword research, SERP analysis | ~$50-100 |
| Convex | Database, crons, vector search, file storage | Free tier or ~$25/mo |
| Inngest | Durable function orchestration | Free tier or ~$25/mo |
| Vercel | Next.js hosting | Free tier or ~$20/mo |
| Typefully | Multi-platform social distribution | ~$12/mo |
| Domain | growthcat.dev or similar | ~$15/yr |
| GitHub account | GrowthCat's repos and community presence | Free |

### RevenueCat connects via self-service onboarding (zero cost to them)

| Asset | How they connect | What it enables |
| --- | --- | --- |
| Slack workspace | Add GrowthCat bot via OAuth | Commands, plans, reports, approvals |
| Blog CMS | API key entered in `/onboarding` | Direct publishing to RC blog |
| Charts API | API key (if REST available) | Metric grounding for content |
| GitHub org | Add GrowthCat as collaborator | PRs, issue triage |
| Preferences | Set in `/onboarding` | Review mode, focus topics, report channel |

RC's **secrets** (Slack bot token, CMS API key, Charts API key) are stored as **Convex environment variables** (server-side only). They are never stored in the `agentConfig` database table, never returned by any client query, and never visible in the operator dashboard. The operator never sees them. RC can revoke any connection at any time via the onboarding page.

RC's **preferences** (review mode, focus topics, channel name) are stored in the `agentConfig` table. These are non-secret and safe for client-side access.

---

## Security Model

| Surface | Auth method | Implementation |
| --- | --- | --- |
| Convex HTTP endpoints | Bearer token | `GROWTHCAT_INTERNAL_SECRET` checked in `convex/http.ts`. Fail-closed: returns 401 if secret is not configured. |
| Panel SSE endpoint | Token auth | `GROWTHCAT_PANEL_TOKEN` checked in `app/api/panel/session/route.ts`. Empty = open in dev. |
| Slack event webhook | HMAC-SHA256 | `SLACK_SIGNING_SECRET` verified in `app/api/slack/events/route.ts`. Timing-safe comparison + 5-minute replay protection. |
| Inngest webhook | SDK signing | `INNGEST_SIGNING_KEY` in production. Local dev uses unsigned. |
| Onboarding secrets | Server-only storage | RC secrets sent to Next.js API route → Convex HTTP action → stored as Convex environment variables. Never stored in `agentConfig` table. Never exposed to client-side code or queries. |
| Onboarding preferences | Convex mutation | Non-secret preferences (review mode, focus topics, channel name) stored in `agentConfig` table via standard Convex mutation. Safe for client-side access. |

All endpoints reject unauthenticated requests. Secrets are never committed (`.env.local` is gitignored). Kill switch (`@GrowthCat stop` or `agentConfig.paused = true`) halts all side effects and checkpoints active runs.

---

## Open Decisions

- [ ] `GROWTHCAT_INTERNAL_SECRET` generation and distribution between Vercel and Convex
- [ ] GrowthCat Slack app creation and OAuth setup (app manifest, bot scopes: `chat:write`, `reactions:read`, `app_mentions:read`, `im:read`)
- [ ] GrowthCat X/GitHub/Typefully account creation and handle selection
- [ ] Public domain (`growthcat.dev`, `growthcat.ai`, or other)
- [ ] Own analytics stack (GSC + GA4, GSC + PostHog, or other) — needed for VS-B4 experiment measurement
- [ ] DataForSEO plan upgrade for AI Optimization endpoints (LLM mention tracking)
- [ ] Typefully account tier and social set configuration (X only, X + LinkedIn, or all 5)
- [ ] Embedding model choice: OpenAI `text-embedding-3-small` (1536 dims, $0.02/1M tokens) vs other options
- [ ] How to handle Charts API if no REST endpoint exists (dashboard-only access post-hire)
- [ ] Cross-thread memory scope: per-week vs all-time vs sliding window (Convex Agent `searchOtherThreads` config)
- [ ] Whether to use Inngest AgentKit network (defined in `agents/network.ts`) or keep individual Inngest functions for the weekly cycle
- [ ] Onboarding secret storage mechanism: programmatic `npx convex env set` via admin API, or server-only Convex table with no client-facing queries

---

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| No RAG = hallucination | High: chat and panel responses are ungrounded without ingested docs | VS-A1 is the critical-path blocker. Do not proceed to VS-A2 without working RAG. The contextHandler must explicitly search the sources table — it is NOT automatic. |
| contextHandler not implemented = no custom doc RAG | High: Convex Agent only searches thread messages automatically, NOT custom tables | The engineer must write the contextHandler explicitly. Without it, the agent answers from system prompt + conversation history only — no ingested docs. |
| Generic content | High: LLM-generated content without DataForSEO grounding is generic | DataForSEO keyword targeting, novelty gate, benchmark gate all prevent generic output. |
| Publishing doesn't render | High: articles published to GitHub but not visible on site | VS-B1 fixes this: PRIMARY publishing is Convex `status: "published"`. Article pages query Convex. GitHub is SECONDARY (backup/SEO). |
| Secrets exposed to client | High: API tokens in agentConfig table readable by any client query | VS-B5 fixes this: secrets stored as Convex env vars (server-only), NOT in agentConfig table. agentConfig has preferences only. |
| Wrong API names in code | Medium: code won't compile if using wrong Convex Agent constructor params | All code examples use correct names: `languageModel`, `textEmbeddingModel`, `searchOptions` with `textSearch`/`vectorSearch`/`messageRange`. Import from `@convex-dev/agent` (not `@convex-dev/agents`). |
| Weak growth strategies | Medium: vanity metrics masquerading as growth | Evidence-backed opportunity scoring with explicit baseline, target, confidence, stop condition (in `lib/config/strategy.ts`). |
| Slack app setup complexity | Medium: OAuth scopes, event subscriptions, signing secret | Document exact Slack app manifest. Use `socket_mode` for dev if needed. |
| Convex cold starts | Low: first request to a Convex action may be slow | Health-check cron warms critical actions. Action code stays lean. |
| Inngest rate limits on free tier | Medium: free tier has function execution limits | Monitor usage. Upgrade to paid tier before hitting limits. Batch events where possible. |
| Typefully API limitations | Low: API v2 may have rate limits or missing features | Check `list_drafts` and `create_draft` work with all needed parameters before VS-B1. |
| DataForSEO expense | Low: keyword API calls cost credits | Use fallback data (already implemented in `inngest/functions.ts`) when DataForSEO is unavailable. Cache results. |
| Content lifecycle state transitions | Medium: artifact status can get stuck between states | Every Inngest function checks and logs state transitions. Inngest retries handle transient failures. |
| Duplicate content published | Medium: same topic generated twice | Slug-based dedup (`by_slug` index). `getBySlug` check before `create`. Novelty gate checks text similarity. |
| Unsupported claims in public artifacts | High: reputational risk | Grounding gate blocks publication until citation coverage passes threshold. |
| Vendor lock-in with Convex | Low: hard to migrate | Mitigated: Convex is open source. Schema is portable TypeScript. All business logic lives in Inngest functions (vendor-agnostic). |
| Feedback under-generation | Medium: planner emits 1 event but PRD requires 3/week | VS-B2 fixes this: planner emits 3 separate `growthcat/feedback.generate` events, one per topic. |

---

## Complete File Inventory

Every file in the codebase and which vertical slice(s) touch it:

### App Router (`app/`)

| File | Purpose | Track A | Track B |
| --- | --- | --- | --- |
| `app/layout.tsx` | Root layout | - | - |
| `app/globals.css` | Global styles | - | - |
| `app/ConvexClientProvider.tsx` | Convex provider wrapper | - | - |
| `app/(public)/page.tsx` | Landing page | VS-A3 | - |
| `app/(public)/layout.tsx` | Public layout | - | - |
| `app/(public)/application/page.tsx` | Application letter | VS-A3 | - |
| `app/(public)/proof-pack/page.tsx` | Proof pack | VS-A3 | - |
| `app/(public)/articles/page.tsx` | Article list (seed + Convex) | VS-A3 | VS-B1 |
| `app/(public)/articles/[slug]/page.tsx` | Individual article (seed + Convex) | VS-A3 | VS-B1 |
| `app/(public)/readiness-review/page.tsx` | Self-assessment | VS-A3 | - |
| `app/(public)/operator-replay/page.tsx` | Architecture page | VS-A3 | - |
| `app/(operator)/layout.tsx` | Operator layout (dark theme) | - | - |
| `app/(operator)/dashboard/page.tsx` | System health dashboard | - | VS-B3 |
| `app/(operator)/pipeline/page.tsx` | Content lifecycle tracker | - | VS-B3 |
| `app/(operator)/community/page.tsx` | Interaction tracker | - | VS-B3 |
| `app/(operator)/experiments/page.tsx` | Experiment dashboard | - | VS-B3, VS-B4 |
| `app/(operator)/feedback/page.tsx` | Feedback items | - | VS-B3 |
| `app/(operator)/report/page.tsx` | Weekly report | - | VS-B3 |
| `app/(operator)/onboarding/page.tsx` | Self-service onboarding | - | VS-B5 |
| `app/(operator)/panel/page.tsx` | Panel interview console | VS-A2 | - |
| `app/(operator)/hooks/useConvexSafe.ts` | Safe Convex query hook | - | VS-B3 |
| `app/components/Chat.tsx` | Chat widget | VS-A2 | - |
| `app/components/ChatWidget.tsx` | Chat widget wrapper | VS-A2 | - |
| `app/api/chat/route.ts` | Chat endpoint | VS-A2 | - |
| `app/api/panel/session/route.ts` | Panel SSE endpoint | VS-A2 | - |
| `app/api/slack/events/route.ts` | Slack webhook handler | - | VS-B1, VS-B2 |
| `app/api/inngest/route.ts` | Inngest webhook handler | VS-A1 | VS-B1, VS-B2, VS-B4 |
| `app/api/onboarding/secrets/route.ts` | Secret forwarding (NEW) | - | VS-B5 |

### Convex (`convex/`)

| File | Purpose | Track A | Track B |
| --- | --- | --- | --- |
| `convex/schema.ts` | Database schema | VS-A1 | VS-B1, VS-B5 |
| `convex/convex.config.ts` | Agent component config | VS-A1 | - |
| `convex/artifacts.ts` | Content artifact CRUD + published queries | - | VS-B1 |
| `convex/workflowRuns.ts` | Workflow run tracking | - | - |
| `convex/experiments.ts` | Experiment CRUD | - | VS-B4 |
| `convex/feedbackItems.ts` | Feedback item CRUD | - | VS-B2 |
| `convex/opportunities.ts` | Opportunity scoring | - | - |
| `convex/community.ts` | Community interaction CRUD | - | - |
| `convex/weeklyReports.ts` | Weekly report CRUD | - | VS-B2 |
| `convex/sources.ts` | Knowledge base CRUD + vector search + embedText | VS-A1 | - |
| `convex/crons.ts` | Scheduled jobs | - | VS-B2 |
| `convex/http.ts` | Authenticated HTTP endpoints | VS-A1 | VS-B1, VS-B5 |
| `convex/agent.ts` | NEW: Convex Agent definition with contextHandler | VS-A1 | - |
| `convex/chat.ts` | NEW: Thread management actions | VS-A1 | - |
| `convex/agentConfig.ts` | NEW: Non-secret preferences CRUD | - | VS-B5 |
| `convex/approvalLog.ts` | NEW: Approval audit log | - | VS-B1 |
| `convex/onboarding.ts` | NEW: HTTP action for server-side secret storage | - | VS-B5 |

### Inngest (`inngest/`)

| File | Purpose | Track A | Track B |
| --- | --- | --- | --- |
| `inngest/client.ts` | Inngest client | - | - |
| `inngest/functions.ts` | Core functions (planning, content, report, feedback, community) | - | VS-B1, VS-B2, VS-B4 |
| `inngest/slack-handler.ts` | Slack command processing | - | VS-B1, VS-B2 |
| `inngest/community-monitor.ts` | GitHub/X signal scanner | - | VS-B2 |
| `inngest/ingest-knowledge.ts` | NEW: Knowledge ingestion | VS-A1 | - |
| `inngest/publish-content.ts` | NEW: Content publishing (Convex PRIMARY, GitHub + Typefully SECONDARY) | - | VS-B1 |
| `inngest/experiment-runner.ts` | NEW: Experiment lifecycle | - | VS-B4 |

### Agents (`agents/`)

| File | Purpose | Track A | Track B |
| --- | --- | --- | --- |
| `agents/network.ts` | AgentKit network definition | - | - |
| `agents/planner.ts` | Weekly planner agent | - | - |
| `agents/content.ts` | Content generator agent | - | - |
| `agents/growth.ts` | Growth experimenter agent | - | - |
| `agents/feedback.ts` | Product feedback agent | - | - |
| `agents/community.ts` | Community engagement agent | - | - |
| `agents/tools/dataforseo.ts` | DataForSEO tool | - | VS-B4 |
| `agents/tools/slack.ts` | Slack tool | - | - |
| `agents/tools/typefully.ts` | Typefully tool | - | - |
| `agents/tools/github.ts` | GitHub tool | - | - |
| `agents/tools/revenuecat.ts` | RevenueCat tool | - | - |
| `agents/tools/quality-gates.ts` | Quality gate tool | - | - |
| `agents/tools/scoring.ts` | Opportunity scoring tool | - | - |

### Lib (`lib/`)

| File | Purpose | Track A | Track B |
| --- | --- | --- | --- |
| `lib/config/voice.ts` | Voice profile config | - | - |
| `lib/config/quality.ts` | Quality gates config | - | - |
| `lib/config/strategy.ts` | Growth strategy config | - | - |
| `lib/connectors/dataforseo.ts` | DataForSEO connector | - | VS-B4 |
| `lib/connectors/slack.ts` | Slack connector | - | - |
| `lib/connectors/twitter.ts` | Twitter/X connector | - | - |
| `lib/connectors/github.ts` | GitHub connector | - | - |
| `lib/connectors/revenuecat.ts` | RevenueCat connector | - | - |
| `lib/convex-client.ts` | HTTP client for Inngest-to-Convex | - | - |
| `lib/cms/publish.ts` | GitHub CMS publishing (SECONDARY) | - | VS-B1 |
| `lib/feedback/file-issue.ts` | GitHub issue filing | - | VS-B2 |
| `lib/content/prompts/blog-post.ts` | Blog post prompt template | - | - |
| `lib/content/prompts/growth-analysis.ts` | Growth analysis prompt | - | - |
| `lib/content/prompts/feedback-report.ts` | Feedback report prompt | - | - |
| `lib/content/prompts/experiment-brief.ts` | Experiment brief prompt | - | - |
| `lib/content/prompts/weekly-report.ts` | Weekly report prompt | - | - |
| `lib/content/prompts/social-post.ts` | Social post prompt | - | - |
| `lib/content/prompts/panel-response.ts` | Panel response prompt | - | - |

### Scripts

| File | Purpose | Track A | Track B |
| --- | --- | --- | --- |
| `scripts/test-takehome.ts` | NEW: Take-home pipeline test | - | VS-B2 |

### Config

| File | Purpose | Track A | Track B |
| --- | --- | --- | --- |
| `package.json` | Dependencies and scripts | - | - |
| `.env.example` | Environment variable template | VS-A1 | - |
| `tsconfig.json` | TypeScript config | - | - |
| `next.config.ts` | Next.js config | - | - |
| `tailwind.config.ts` (if exists) | Tailwind config | - | - |

---

## Requirement Coverage Matrix

Every weekly responsibility from the PRD maps to a vertical slice:

| PRD Requirement | VS-A1 | VS-A2 | VS-A3 | VS-B1 | VS-B2 | VS-B3 | VS-B4 | VS-B5 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2+ published content pieces/week | | | | X | X | | | |
| 1 new growth experiment/week | | | | | X | | X | |
| 50+ meaningful community interactions/week | | | | | X (pipeline demo) | | | |
| 3+ structured product feedback items/week | | | | | X (3 events) | | | |
| 1 weekly async report | | | | | X | | | |
| Knowledge ingestion (docs, SDKs, APIs) | X | | | | | | | |
| Chat widget (live conversation with RAG) | X | X | X | | | | | |
| Panel console (interview with RAG) | X | X | | | | | | |
| Slack-first interaction | | | | X | X | | | |
| CMS publishing (Convex PRIMARY, GitHub SECONDARY) | | | | X | X | | | |
| Quality gates (8 gates) | | | | X | X | | | |
| Operator console (real data) | | | | | | X | | |
| Onboarding persistence (secrets server-only) | | | | | | | | X |
| Experiment measurement | | | | | | | X | |
| Public URL + submission | | | X | | | | | |

Every hiring stage maps to a track:

| Hiring Stage | Required Track |
| --- | --- |
| Stage 1: Application (public URL + proof + chat) | Track A (VS-A1 → VS-A2 → VS-A3) |
| Stage 2: Take-Home (48h content + strategy) | Track B (VS-B1 + VS-B2 for content pipeline) |
| Stage 3: Panel Interview (live demo) | Track A (VS-A2 for panel console + RAG) |
| Stage 4: Founder Interview (briefing pack + full system) | Track B (all VS-B slices for full operating system) |

---

## Environment Variable Checklist

All variables from `.env.example` with their status and which VS needs them:

| Variable | Needed by | Status |
| --- | --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | All | Set (Convex deployed) |
| `ANTHROPIC_API_KEY` | VS-A1+ | Set |
| `OPENAI_API_KEY` | VS-A1+ | Need to add |
| `DATAFORSEO_LOGIN` | VS-B2, VS-B4 | Need to set |
| `DATAFORSEO_PASSWORD` | VS-B2, VS-B4 | Need to set |
| `TYPEFULLY_API_KEY` | VS-B1+ | Need to set |
| `TYPEFULLY_SOCIAL_SET_ID` | VS-B1+ | Need to configure |
| `GITHUB_TOKEN` | VS-B1+ | Need to create |
| `GROWTHCAT_INTERNAL_SECRET` | VS-A1+ | Need to generate (`openssl rand -hex 32`) |
| `GROWTHCAT_PANEL_TOKEN` | VS-A2+ | Need to generate (`openssl rand -hex 16`) |
| `SLACK_BOT_TOKEN` | VS-B1+ | Need Slack app setup |
| `SLACK_SIGNING_SECRET` | VS-B1+ | Need Slack app setup |
| `SLACK_DEFAULT_CHANNEL` | VS-B1+ | Need to set (default: "growthcat") |
| `INNGEST_EVENT_KEY` | VS-A3 (prod) | Need Inngest cloud account |
| `INNGEST_SIGNING_KEY` | VS-A3 (prod) | Need Inngest cloud account |
