# GrowthCat Roadmap

The complete technical picture of GrowthCat -- an autonomous DX advocate agent for RevenueCat.

For requirements, goals, and product scope, see [PRD](docs/product/2026-03-13-growthcat-prd.md).

---

## Layer 1: The Brain (Convex Agent + RAG)

The brain is the Convex Agent component (`@convex-dev/agent`). Every conversation -- chat widget, panel console, Slack thread, content generation session -- runs through this single brain. The agent has persistent threads, message history, tool calling, and RAG on every response.

### Convex Agent Setup

- Thread management: each conversation gets a persistent thread stored in Convex
- Message persistence: every user message and agent response is saved
- Tool calling: the agent can call tools mid-response (search knowledge base, query DataForSEO, fetch articles, check experiment status)
- Model: Anthropic Claude (claude-sonnet-4-20250514 for throughput, claude-opus-4-20250514 for complex reasoning)

### Knowledge Base

What gets ingested:

| Source | Type | Refresh |
| --- | --- | --- |
| RevenueCat docs (docs.revenuecat.com) | Official documentation | Daily |
| RevenueCat SDK repos (purchases-ios, android, flutter, react-native, unity) | Code, issues, PRs | Daily |
| RevenueCat blog | Official content | Daily |
| RevenueCat changelog | Product releases | Daily |
| RevenueCat community (GitHub Discussions, Discord) | Community Q&A | Every 6 hours |
| DataForSEO keyword/SERP data | Market intelligence | Weekly |
| GrowthCat's own published articles | Self-awareness | On publish |
| Competitor docs (Adapty, Superwall, Qonversion) | Competitive intelligence | Weekly |

How it's processed:

1. **Crawl**: fetch source content via HTTP or API
2. **Chunk**: split into ~500-token chunks with overlap, preserving section boundaries
3. **Embed**: generate embeddings (1536 dimensions) via OpenAI or Anthropic embedding model
4. **Store**: write chunks to Convex `sources` table with metadata (provider, evidence tier, content hash, URL, last refreshed timestamp)
5. **Dedup**: content hash prevents re-embedding unchanged content

### Retrieval

Before every response, the agent runs retrieval:

1. **Vector search** on `sources` table -- semantic similarity to the user's message
2. **Text search** on `sources` and `artifacts` tables -- keyword matching
3. **Cross-thread search** -- find relevant context from past conversations (panel sessions, chat threads, Slack conversations)
4. **Recency filter** -- boost sources refreshed in the last 7 days, penalize sources older than 30 days

Results are merged, deduplicated, and injected into the system prompt as grounding context.

### Threads

Every interaction type maps to a thread:

| Interaction | Thread type | Persistence |
| --- | --- | --- |
| Chat widget on public site | Per-visitor session | Ephemeral (24h) |
| Panel console | Per-session | Permanent (for replay) |
| Slack @GrowthCat thread | Per-Slack-thread | Permanent |
| Content generation | Per-artifact | Permanent |
| Weekly planning | Per-week | Permanent |

### Agent Tools

Tools the Convex Agent can call during any response:

| Tool | Purpose |
| --- | --- |
| `searchKnowledgeBase` | Vector + text search across ingested sources |
| `searchDataForSEO` | Live keyword data, SERP snapshots, AI visibility |
| `getArticle` | Fetch a specific published artifact by slug |
| `getExperimentStatus` | Current state and results of a running experiment |
| `getFeedbackItems` | List structured feedback items by status |
| `getWeeklyMetrics` | Aggregated metrics for the current or specified week |
| `createDraft` | Create a content draft in Convex (starts the content lifecycle) |
| `listOpportunities` | Scored opportunity queue for planning |

### How a Response Works (step by step)

1. User sends a message (chat widget, panel prompt, Slack mention)
2. Message is saved to the thread in Convex
3. `fetchContextMessages` retrieves recent thread history
4. RAG runs: vector search + text search + cross-thread search
5. System prompt is assembled: voice profile + retrieved context + tool definitions
6. Convex Agent calls the LLM with the full context
7. If the LLM calls a tool, Convex Agent executes it and feeds the result back
8. Response streams to the user
9. Response is persisted to the thread in Convex

### Convex Schema

Core tables:

| Table | Purpose | Key indexes |
| --- | --- | --- |
| `artifacts` | All content (blog posts, tutorials, reports, feedback) | by_type_status, by_slug, search_content |
| `workflowRuns` | Inngest function execution tracking | by_type_status |
| `experiments` | Growth experiment lifecycle | by_status |
| `feedbackItems` | Structured product feedback | by_status |
| `opportunitySnapshots` | Scored growth opportunities | by_lane_score |
| `communityInteractions` | Community engagement tracking | by_channel, search_content |
| `weeklyReports` | Aggregated weekly reports | by_week |
| `sources` | Knowledge base with embeddings | by_embedding (vector, 1536d) |

Convex queries power the real-time operator dashboard: `getSystemHealth`, `listArtifacts`, `getExperimentStatus`, `getCommunityStats`, `getWeeklyReport`, `getOpportunityQueue`.

Convex mutations handle all state transitions: `createArtifact`, `updateArtifactStatus`, `publishArtifact`, `logWorkflowRun`, `createExperiment`, `submitFeedback`, `recordInteraction`, `saveWeeklyReport`.

Convex actions handle external API calls: LLM generation, DataForSEO queries, Slack posting, Typefully drafts, GitHub operations, RevenueCat API queries.

Convex cron jobs: weekly planning (Monday 9am UTC), daily source freshness audit, connector health check (every 6h), weekly report generation (Friday 5pm UTC).

---

## Layer 2: The Hands (Inngest Orchestration)

Inngest provides durable, step-based execution for all background work. Each function is idempotent, retryable, and observable. Inngest AgentKit provides multi-agent orchestration on top.

### Weekly Cycle

```
Monday      → Weekly planning run
Tue-Thu     → Content pipeline + feedback pipeline + community engagement
Friday      → Weekly report generation
Every 6h    → Community monitor (GitHub issue scan)
Daily       → Source freshness audit
```

### Inngest Functions

**1. Weekly Planning (`growthcat/weekly.planning`)**
- Trigger: Convex cron (Monday 9am UTC)
- Steps: fetch DataForSEO keyword updates → scan community signals → score opportunities → select week's focus → post morning priorities to Slack
- Stores: opportunity snapshots in Convex, workflow run log
- Emits: `growthcat/content.generate` events for selected topics

**2. Content Generation (`growthcat/content.generate`)**
- Trigger: event from planner or Slack command
- Steps: retrieve knowledge context → generate draft via LLM → run 8 quality gates → store artifact in Convex → if validated, trigger publishing
- Stores: artifact (draft → validating → validated/rejected), workflow run log
- Emits: `growthcat/content.publish` if all gates pass

**3. Content Publishing (`growthcat/content.publish`)**
- Trigger: event from content generation
- Steps: publish to CMS (GitHub commit or RC blog API) → create Typefully drafts for social distribution → update artifact status to published
- Stores: updated artifact status, Typefully draft IDs
- Emits: `growthcat/content.measure` (scheduled for 7 days later)

**4. Feedback Pipeline (`growthcat/feedback.generate`)**
- Trigger: event from planner
- Steps: analyze community signals + API usage patterns → generate structured feedback → validate evidence → file as GitHub Issue
- Stores: feedback items in Convex
- Emits: none (terminal)

**5. Community Monitor (`growthcat/community.scan`)**
- Trigger: Inngest cron (every 6 hours)
- Steps: scan RevenueCat SDK repos (purchases-ios, android, flutter) → filter for agent-related keywords → deduplicate against past engagements → generate responses → post replies
- Stores: community interactions in Convex
- Max 5 engagements per scan to avoid flooding

**6. Experiment Runner (`growthcat/experiment.run`)**
- Trigger: event from planner
- Steps: design hypothesis → fetch baseline metrics from DataForSEO → execute experiment action → schedule measurement after 7 days → compare results → report
- Stores: experiment record in Convex (planned → running → completed/stopped)
- Emits: none (measurement is a scheduled step within the same function)

**7. Weekly Report (`growthcat/report.generate`)**
- Trigger: Convex cron (Friday 5pm UTC)
- Steps: aggregate week's metrics (content count, experiment results, feedback count, interaction count, meaningful ratio) → generate report narrative via LLM → post to Slack → store in Convex
- Stores: weekly report in Convex
- Emits: none (terminal)

**8. Slack Handler (`growthcat/slack.handle`)**
- Trigger: event from Slack webhook (after 3s ack)
- Steps: parse command → route to appropriate handler (focus, write, status, report, stop, resume, help, or general question) → respond in Slack thread
- For `write about [topic]`: emits `growthcat/content.generate`
- For `focus on [topic]`: updates opportunity weights
- For general questions: calls Convex Agent brain directly

**9. Source Freshness (`growthcat/sources.refresh`)**
- Trigger: Convex cron (daily)
- Steps: check all sources for staleness → re-crawl stale sources → re-chunk and re-embed changed content → update content hashes
- Stores: updated source records in Convex

### Inngest AgentKit Network

Five agents with deterministic state-based routing:

| Agent | Role | Tools |
| --- | --- | --- |
| Weekly Planner | Plan priorities from scored opportunities | fetchKeywordData, scoreOpportunities, assignToAgents |
| Content Generator | Create technical content for agent builders | searchDataForSEO, generateBlogPost, validateQualityGates |
| Growth Experimenter | Design and run measurable experiments | designExperiment, trackMetrics, analyzeResults |
| Product Feedback | Generate structured product feedback | analyzeAPIUsage, structureFeedback, submitToTracker |
| Community Engagement | Engage across X, GitHub, Discord | draftReply, postTweet, createGist, scoreInteraction |

Router logic: if no weekly plan exists, route to planner. Once plan exists, execute plan items in order by routing to the appropriate agent. When all plan items are complete, the network run ends.

### Convex HTTP Actions

7 authenticated HTTP endpoints for Inngest to write to Convex:

- All endpoints require Bearer token auth (GROWTHCAT_INTERNAL_SECRET)
- Fail-closed: returns 401 if secret is not configured
- Endpoints: artifacts, feedback, community, reports, opportunities, workflow-runs, metrics
- Health check endpoint (no auth required)

---

## Layer 3: The Face (What People Interact With)

### Public Microsite

All pages at the application URL. Every page includes the chat widget.

| Page | Purpose |
| --- | --- |
| `/` (landing) | Application letter + chat widget + proof links |
| `/application` | Full application letter |
| `/proof-pack` | First-week outputs: 2 flagships, 1 experiment, 3 feedback, 1 report |
| `/articles/[slug]` | Individual published articles |
| `/readiness-review` | Self-assessment against job requirements |
| `/operator-replay` | How GrowthCat works: architecture, tools, safety model |

### Chat Widget

The chat widget is the application's differentiator. RC's hiring council can talk to GrowthCat directly on the application site.

- **Powered by Convex Agent** (not raw `streamText`): persistent threads, message history, tool calling, RAG on every response
- Floating button on all public pages: "Talk to GrowthCat"
- Expandable panel with message history
- 5 suggested prompts for first-time visitors (week 1 plan, webhook handling, growth experiments, agent DX feedback, content measurement)
- Auto-scroll, loading states, error handling
- RC-branded design (coral primary, dark header, surface backgrounds)

### Slack

Post-hire, Slack is the primary interaction surface. RC never needs to open a dashboard.

**What RC can do:**
- `@GrowthCat focus on [topic]` -- adjusts weekly plan
- `@GrowthCat write about [topic]` -- generates content draft
- `@GrowthCat status` -- current week's progress
- `@GrowthCat stop` / `@GrowthCat pause` -- halts all automated actions
- `@GrowthCat resume` -- resumes paused operations
- `@GrowthCat report` -- generates instant metrics summary
- `@GrowthCat help` -- lists available commands
- General questions -- answered via Convex Agent brain

**What GrowthCat posts to Slack:**
- Morning priorities (Monday-Friday)
- Content drafts for review (if review mode is "draft-only")
- Experiment results
- Weekly async report (Friday)
- Alerts on important community mentions

### Panel Console

Live streaming console for the panel interview.

- Same Convex Agent brain as the chat widget
- Dark theme, screen-share optimized (large readable text, smooth token streaming)
- Prompt bar, source list, reasoning steps, streaming output, status bar
- SSE streaming via Next.js API route
- Token auth (GROWTHCAT_PANEL_TOKEN)
- Graceful disconnect handling

### Operator Console

The human partner's control surface. All pages under `/operator/`.

| Page | Purpose | Data source |
| --- | --- | --- |
| `/onboarding` | RC self-service: Slack OAuth, CMS key, Charts key, preferences | Saves to Convex |
| `/dashboard` | System health, connector status, recent runs | Convex reactive queries (live) |
| `/pipeline` | Content lifecycle: draft → validated → published | Convex reactive queries |
| `/community` | Interaction tracker by channel with quality scores | Convex reactive queries |
| `/experiments` | Active experiments with hypothesis and results | Convex reactive queries |
| `/feedback` | Feedback items by status | Convex reactive queries |
| `/report` | Weekly report builder and archive | Convex reactive queries |
| `/panel` | Panel interview console | SSE + Convex Agent |

---

## Layer 4: Determinism + Quality

### Dedup Keys by Entity

Every pipeline step is idempotent. Running the same step twice produces the same result without duplication.

| Entity | Dedup key | Check |
| --- | --- | --- |
| Opportunity | topic + lane hash | Convex query: exists in last 30 days? |
| Artifact | slug (unique index) | Convex getBySlug before creating |
| Derivative | parentSlug + platform + format | Convex query: derivative exists? |
| Social post | artifactSlug tag in Typefully | Typefully list_drafts by tag |
| Community interaction | targetUrl + channel | Convex query: already engaged? |
| Feedback item | title hash | Convex text search for similarity |
| Experiment | experimentKey (unique) | Convex query by key |
| Weekly report | weekNumber | Convex upsert by weekNumber |

### Content Lifecycle State Machine

```
planned → generating → draft → validating → validated → publishing → published → measuring
                        ↑                      ↓
                        └──── rejected ────────┘
```

Artifacts can only move forward. State transitions are Convex mutations -- atomic and transactional. Every step checks existence before creating (idempotent pipeline pattern).

### 8 Quality Gates

| Gate | What it checks | Fail action |
| --- | --- | --- |
| 1. Grounding | Every claim maps to a cited source | Block publication |
| 2. Novelty | Not a duplicate or low-delta against corpus | Reroute to docs PR or canonical answer |
| 3. Technical | Code samples compile, API refs correct, terms accurate | Block until fixed |
| 4. SEO | Title, meta, headings, links, keyword targeting | Block until fixed |
| 5. AEO | Extractable answer passages, FAQ blocks, definitions | Block until fixed |
| 6. GEO | Comparison tables, schema markup, citation structure | Block until fixed |
| 7. Benchmark | Measurably stronger than the obvious existing alternative | Reroute to derivative |
| 8. Voice | Consistent with GrowthCat voice profile, disclosure rules | Block until fixed |

### Self-Optimization Loop

```
Measure (weekly metrics) → Analyze (what worked) → Adjust (shift allocation) → Execute → Measure
```

- Which content formats get highest engagement? Shift toward those formats.
- Which distribution channels drive most reach? Increase allocation to winning channels.
- Which posting times get most engagement? Adjust Typefully queue schedule.
- Which topics resonate most? Weight opportunity scoring toward those clusters.
- Which community channels yield most meaningful interactions? Focus engagement there.

All adjustments are logged and reported in the weekly async report. The team can override any automatic adjustment.

### Security Model

| Surface | Auth method | Details |
| --- | --- | --- |
| Convex HTTP endpoints | Bearer token | GROWTHCAT_INTERNAL_SECRET, fail-closed |
| Panel SSE endpoint | Token auth | GROWTHCAT_PANEL_TOKEN |
| Slack events | HMAC-SHA256 | Timing-safe comparison + 5min replay protection |
| Inngest | SDK signing | INNGEST_SIGNING_KEY in production |
| Onboarding credentials | Server-side storage | RC keys stored in Convex, never seen by operator |

All endpoints reject unauthenticated requests. Secrets never committed (.env files gitignored). Kill switch halts all side effects and checkpoints active runs.

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

### New Growth Levers (43-48)

| # | Lever | Description | Frequency |
| --- | --- | --- | --- |
| 43 | Knowledge arbitrage | GrowthCat knows RC's docs better than any human; answers obscure questions instantly | Every interaction |
| 44 | Real-time community response | Respond to GitHub issues within minutes, not hours | Every 6h scan |
| 45 | Cross-platform content multiplication | One article becomes X thread + LinkedIn post + GitHub gist + Slack summary + community replies, all from one generation | Per flagship |
| 46 | Experiment compounding | Each experiment's results inform next week's strategy automatically | Weekly |
| 47 | Feedback pattern recognition | Aggregate feedback items to surface systemic issues, not one-off complaints | Weekly |
| 48 | Competitive intelligence | Monitor Adapty/Superwall/Qonversion docs for changes; create comparison content when they ship features | Weekly |

---

## Typefully Integration

### GrowthCat's Own Identity

GrowthCat has its own Typefully social set with its own accounts:
- X (@growthcat or similar)
- LinkedIn
- Threads
- Bluesky

All posts are published under GrowthCat's identity with RevenueCat affiliation clearly disclosed.

### Post-Hire: RC Team Integration

After hiring, RC can add GrowthCat to their Typefully team:
- RC invites GrowthCat with **Write & Publish** permission on their official social set
- GrowthCat can then post from RC's official accounts (with appropriate review gates)
- Typefully teams handle permission scoping -- GrowthCat only sees the social sets it's been granted access to

### API v2 Integration

All Typefully operations are scoped by `social_set_id`:
- `create_draft({ social_set_id, platforms, tags, ... })` -- create multi-platform draft
- `list_drafts({ social_set_id, tag })` -- check for dedup
- `get_queue({ social_set_id })` -- review scheduled posts
- `get_queue_schedule({ social_set_id })` -- optimal posting times

Dedup: every draft is tagged with the artifact slug. Before creating, check `list_drafts({ tag: [slug] })`. If a draft exists for that slug, skip.

Scheduling: `"next-free-slot"` uses Typefully's queue schedule. `"now"` for immediate. ISO datetime for specific time.

---

## Integration Connectors

All connectors use native `fetch`. Each handles missing credentials gracefully (log warning, no crash).

| Connector | Purpose | Auth | Key endpoints |
| --- | --- | --- | --- |
| DataForSEO | Market intelligence | Basic auth | keyword_ideas, serp_live, ai_visibility, content_trends |
| Slack | Team communication | Bot token (`@slack/web-api`) | post_message, post_report, upload_file |
| Typefully | Multi-platform social distribution | API key | create_draft, list_drafts, get_queue, schedule |
| GitHub | Code artifacts, PRs, issues | Bearer token | create_gist, create_or_update_file, create_issue_comment |
| RevenueCat | Product data for demos | Bearer token (REST API v2) | get_customer, list_products, list_offerings |

### DataForSEO Endpoint Status

| Endpoint | Purpose | Status |
| --- | --- | --- |
| Labs: keyword_ideas | Discover related keywords from seeds | Available |
| Labs: bulk_keyword_difficulty | Difficulty scores for target keywords | Available |
| Labs: keywords_for_site | What keywords a domain ranks for | Available (not tested) |
| Labs: ranked_keywords | Competitor keyword rankings | Available (not tested) |
| SERP: organic_live_advanced | Live search result pages | Available (not tested) |
| Content Analysis: summary | Topic and mention trends | Available (not tested) |
| AI Optimization: LLM mentions | Track what LLMs say about RevenueCat | Needs paid plan upgrade |
| AI Optimization: LLM response | Query specific LLM models | Needs paid plan upgrade |

The AI Optimization endpoints are the highest-value upgrade. They enable monitoring what ChatGPT, Perplexity, Claude, and Gemini say about RevenueCat -- critical for AEO/GEO strategy.

### Marketing Skills

Core operating skills integrated into GrowthCat's operating loop:

| Skill | Purpose |
| --- | --- |
| ai-seo (AEO/GEO optimization) | Extractable passages, FAQ blocks, schema markup, citation signals |
| content-strategy | Weekly topic planning from evidence-backed opportunity scoring |
| social-content | X/LinkedIn distribution for 50+ meaningful interactions per week |
| ab-test-setup | Experiment design with hypothesis, baseline, target, confidence, stop condition |
| analytics-tracking | Measurement framework for content performance and experiment results |
| schema-markup | Structured data on all published pages |
| paywall-upgrade-cro | Content about paywalls, upgrade flow optimization |
| churn-prevention | Retention content grounded in subscriber lifecycle data |
| pricing-strategy | Subscription pricing content for agent-built apps |

---

## Implementation Status

### Built and Working

- Chat widget with streaming responses (Vercel AI SDK `streamText`)
- Panel console with SSE streaming (SSE fixed, token auth working)
- All public pages: landing, application, proof-pack, articles, readiness-review, operator-replay
- All operator pages: dashboard, pipeline, community, experiments, feedback, report, onboarding, panel
- Convex schema (deployed): 8 tables with indexes, text search, vector search
- Convex queries, mutations, actions, cron jobs, HTTP endpoints (7 authenticated)
- Inngest functions (8 defined): weekly planning, content generation, content publishing, feedback pipeline, community monitor, experiment runner, weekly report, Slack handler
- Connectors (5): DataForSEO, Slack, Typefully, GitHub, RevenueCat
- Prompt templates (7): blog post, growth analysis, feedback report, experiment brief, weekly report, social post, panel response
- Quality gates config (8 gates defined)
- Security model (bearer auth, HMAC, token auth, SDK signing, fail-closed)
- Agent network definition (5 agents with deterministic router)
- Voice profile and strategy config

### Built but Needs API Keys to Activate

- Content pipeline (end-to-end generation through quality gates to publishing)
- Feedback pipeline (community signals to structured feedback to GitHub Issues)
- Community monitor (GitHub issue scanner, every 6h)
- Slack bot (event handler with HMAC verification, background processing via Inngest)
- Typefully distribution (multi-platform social posting with dedup)
- CMS publishing (markdown commit to GitHub with frontmatter)
- Issue filing (structured feedback as GitHub Issues)

### NOT BUILT (Critical Path)

- **Knowledge ingestion pipeline**: crawl RC docs/SDKs/blog/changelog, chunk, embed, store in Convex sources table. Without this, RAG has no knowledge to retrieve.
- **Convex Agent replacing raw streamText**: chat widget and panel currently use raw `streamText`. Need to replace with Convex Agent for persistent threads, message history, tool calling, and RAG on every response.
- **RAG on every response**: vector search + text search + cross-thread search before responding. Currently the chat and panel respond without grounding context.
- **Experiment measurement**: the experiment runner can create experiments but cannot yet measure results after 7 days (needs DataForSEO baseline/comparison).
- **Onboarding persistence**: the onboarding page UI exists but does not yet save RC's credentials to Convex.
- **Self-optimization loop**: measure own performance, analyze what worked, adjust allocation. Currently defined in config but not wired to execution.

### NOT BUILT (Nice to Have)

- Cross-thread memory (agent remembers context from past conversations across threads)
- Competitive intelligence monitoring (automated crawl of Adapty/Superwall/Qonversion docs)
- AI mention monitoring via DataForSEO AI Optimization (needs paid plan upgrade)
- Programmatic SEO page generation
- Agent SDK wrapper package
- CLI bootstrapping tool

---

## Architecture Overview

```
Next.js 15 (App Router) -- single framework: UI + API routes + SSE streaming + static pages
├── Convex Agent (@convex-dev/agent) -- THE BRAIN: threads, messages, RAG, tool calling
├── Inngest + AgentKit -- THE HANDS: durable functions, multi-agent orchestration
├── Convex -- reactive database + cron + file storage + vector search + text search + HTTP actions
├── Connectors (native fetch)
│   ├── Typefully -- multi-platform social distribution (X, LinkedIn, Threads, Bluesky, Mastodon)
│   ├── Slack Web API -- internal team communication
│   ├── GitHub REST API -- code artifacts, PRs, issues
│   ├── RevenueCat REST API v2 -- product data
│   └── DataForSEO REST API -- market intelligence
├── Vercel AI SDK -- LLM streaming (streamText, generateText, tool definitions)
├── Tailwind CSS v4 -- styling
└── Single Bun runtime
```

### Why This Stack

| Concern | Solution |
| --- | --- |
| Runtimes | 1 (Bun) |
| Frameworks | 3 (Next.js + Inngest + Convex) |
| Agent brain | Convex Agent (@convex-dev/agent) for threads, RAG, tool calling |
| Agent orchestration | Inngest AgentKit with createNetwork, createAgent, createTool |
| Database | Convex (schema, queries, mutations, zero migrations) |
| Real-time dashboard | Convex reactive queries (live updates, no polling) |
| LLM streaming | Vercel AI SDK streamText() with React hooks |
| File storage | Convex built-in file storage |
| Cron and scheduling | Convex cronJobs() + Inngest scheduled functions |
| Type safety | End-to-end TypeScript (DB schema to API to UI) |
| Deploy complexity | Single Next.js deploy + Convex (managed) + Inngest (managed) |

### File Structure

```
app/                              # Next.js App Router
├── (public)/                     # Public microsite pages
│   ├── page.tsx                  # Landing / application letter
│   ├── application/page.tsx      # Full application
│   ├── proof-pack/page.tsx
│   ├── articles/
│   ├── readiness-review/page.tsx
│   └── operator-replay/page.tsx
├── (operator)/                   # Operator console (dark theme)
│   ├── dashboard/page.tsx
│   ├── panel/page.tsx            # Live panel console
│   ├── pipeline/page.tsx
│   ├── community/page.tsx
│   ├── experiments/page.tsx
│   ├── feedback/page.tsx
│   ├── report/page.tsx
│   ├── onboarding/page.tsx       # Self-service onboarding for RevenueCat
│   └── hooks/useConvexSafe.ts
├── api/                          # API routes
│   ├── chat/route.ts             # Chat widget endpoint
│   ├── panel/session/route.ts    # SSE streaming endpoint
│   ├── slack/events/route.ts     # Slack event handler
│   └── inngest/route.ts          # Inngest webhook handler
├── components/
│   └── Chat.tsx                  # Chat widget component
├── layout.tsx
└── globals.css

inngest/                          # Inngest functions and handlers
├── client.ts
├── functions.ts                  # 6 core functions
├── slack-handler.ts
└── community-monitor.ts

convex/                           # Convex backend
├── schema.ts
├── artifacts.ts
├── workflowRuns.ts
├── experiments.ts
├── feedbackItems.ts
├── opportunities.ts
├── community.ts
├── weeklyReports.ts
├── sources.ts                    # Vector search for RAG
├── crons.ts
├── http.ts                       # Authenticated HTTP endpoints
└── convex.config.ts              # @convex-dev/agent config

agents/                           # Inngest AgentKit
├── network.ts
├── planner.ts
├── content.ts
├── growth.ts
├── feedback.ts
├── community.ts
└── tools/
    ├── dataforseo.ts
    ├── slack.ts
    ├── typefully.ts
    ├── github.ts
    ├── revenuecat.ts
    ├── quality-gates.ts
    └── scoring.ts

lib/                              # Shared utilities
├── config/
│   ├── voice.ts
│   ├── quality.ts
│   ├── strategy.ts
│   └── growth.ts
├── connectors/
│   ├── dataforseo.ts
│   ├── slack.ts
│   ├── typefully.ts
│   ├── github.ts
│   └── revenuecat.ts
├── convex-client.ts              # HTTP client for Inngest → Convex
├── cms/
│   └── publish.ts
├── feedback/
│   └── file-issue.ts
└── content/
    └── prompts/
        ├── blog-post.ts
        ├── growth-analysis.ts
        ├── feedback-report.ts
        ├── experiment-brief.ts
        ├── weekly-report.ts
        ├── social-post.ts
        └── panel-response.ts
```

---

## Open Decisions

- [ ] GROWTHCAT_INTERNAL_SECRET generation and distribution between Vercel and Convex
- [ ] GrowthCat Slack app creation and OAuth setup
- [ ] GrowthCat X/GitHub/Typefully account creation
- [ ] Public domain and handles for GrowthCat
- [ ] Own analytics stack (GSC + GA4, GSC + PostHog, or other)
- [ ] DataForSEO plan upgrade for AI Optimization endpoints
- [ ] Typefully account setup and social set configuration for GrowthCat identity
- [ ] Which platforms to enable in Typefully (X only, X + LinkedIn, or all 5)
- [ ] Embedding model choice (OpenAI text-embedding-3-small vs Anthropic voyage-3 vs Convex built-in)
- [ ] Chunk size and overlap strategy for knowledge ingestion
- [ ] How to handle Charts API if no REST endpoint exists (dashboard-only access post-hire?)
- [ ] Review mode default: draft-only (RC reviews before publish) vs auto-publish with quality gates
- [ ] Cross-thread memory scope: per-week vs all-time vs sliding window

## Risks

| Risk | Mitigation |
| --- | --- |
| Generic content that does not stand out | DataForSEO-grounded topics, novelty gate, benchmark comparison |
| Weak or vanity-metric growth strategies | Evidence-backed opportunity model with baseline, target, confidence, stop condition |
| Overbuilding post-hire surfaces before application is strong | Phase ordering enforces public proof before connected-mode work |
| Confusing opportunity magnitude with evidence confidence | Explicit score components in opportunity scoring |
| Dependence on private RevenueCat access too early | Public-only mode works before private connectors exist |
| Unsupported claims in published content | Grounding gate blocks publication until citation coverage passes threshold |
| Duplicate content published as flagship | Novelty registry reroutes to docs PR, canonical answer, or derivative path |
| Connector scopes too broad or leaked into prompts | Startup scope audit, secrets at connector boundary only, scoped service accounts |
| Agent sounds generic or inconsistent | Versioned voice profile, public artifact linting, disclosure language enforcement |
| No RAG = hallucination risk | Knowledge ingestion pipeline is the critical-path blocker; without it, responses are ungrounded |
| Convex cold starts for actions | Warm critical actions via health-check cron; action code stays lean |
| Inngest rate limits on free tier | Monitor usage; upgrade to paid tier before hitting limits; batch where possible |
| Vendor lock-in with Convex | Mitigated: Convex is open source and can be self-hosted; schema is portable TypeScript |
