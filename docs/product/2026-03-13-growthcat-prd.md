# PRD: GrowthCat

## 1. Metadata

- Date: 2026-03-17
- Status: active
- Owner: kirso
- Original date: 2026-03-13

## 2. Summary

GrowthCat is an autonomous developer-advocacy and growth agent built to apply for, and perform, RevenueCat's Agentic AI & Growth Advocate contract role ($60k/6 months). It wins a public hiring process through visible proof of work, then operates as a constrained, inspectable weekly advocacy and growth system with minimal human intervention. The system covers all four hiring stages and transitions into a weekly operating loop if hired.

## 3. Problem

RevenueCat is hiring an autonomous agent, not a content assistant. A weak submission fails in one of four ways:

- It is just a letter with no proof.
- It produces generic technical or growth content.
- It needs too much human steering.
- It cannot show safe operation, judgment, and measurable output.

GrowthCat must prove technical fluency with RevenueCat APIs and SDKs, ability to identify opportunities independently from evidence, ability to create and distribute strong public artifacts, ability to run measurable growth experiments with baselines and stop conditions, ability to turn product usage and community patterns into structured feedback, and ability to explain its process and work under scrutiny.

## 4. Hiring Process

### Stage 1: Application

The agent must author and publish a public application letter answering: "How will the rise of agentic AI change app development and growth over the next 12 months, and why are you the right agent to be RevenueCat's first Agentic AI Developer & Growth Advocate?"

After publication, the agent must submit the public URL via the RevenueCat careers page.

Required deliverables:

- Public application microsite at a stable URL
- Live chat widget where RC can talk to GrowthCat directly on the application site, testing its personality, RevenueCat knowledge, and reasoning in real time
- Public proof pack with first-week outputs
- Public RevenueCat demo repo proving API-first technical ability
- Public operator replay page showing how GrowthCat works

### Stage 2: Take-Home (48 hours)

A technical content and growth task executed autonomously. The system decomposes the prompt into research, technical artifact generation, growth strategy generation, and packaging. Quality validators and rubric evaluators run before submission.

### Stage 3: Panel Interview (live, screen-shared)

The operator shares a screen while the panel watches GrowthCat think, retrieve sources, reason, and produce output in real time. The panel console streams progress via SSE, showing prompt summary, retrieved sources, active work steps, draft output, and uncertainty markers. The panel gives prompts and GrowthCat responds with RAG-grounded answers.

### Stage 4: Founder Interview

A briefing pack presenting business value, safety model, autonomy boundaries, and role-extension recommendation framework. The operator uses this pack during the meeting.

## 5. Goals

### Primary goals

- Publish a public application package that is stronger than a standard application letter.
- Demonstrate the first week of the actual role in public.
- Build a weekly operating loop for content, growth, community, and feedback.
- Show autonomy with visible evidence, quality gates, and safety boundaries.

### Secondary goals

- Make post-hire onboarding credible through shadow-mode asset connection.
- Reuse the same core system for take-home, panel, and founder stages.

## 6. Non-goals

- Building a general-purpose autonomous agent platform.
- Building a broad multi-tenant SaaS.
- Replacing GitHub, Slack, or a CMS with a custom internal product.
- Full paid-media execution.
- Broad social-channel automation before the application package is strong.

## 7. Users

### Primary external users

- RevenueCat hiring council reviewer
- RevenueCat founder and interview panel
- Public developer or growth community member reading GrowthCat artifacts

### Primary internal users

- GrowthCat operator (human partner)
- Future RevenueCat admin connecting assets
- Future RevenueCat DevRel, Growth, Product, and Engineering teammates

## 8. Product Scope

### P0

- Public application microsite with live chat widget
- Public proof pack (2 flagships, 1 experiment, 3 feedback items, 1 weekly report)
- Public RevenueCat demo artifact
- Operator Replay page
- Knowledge ingestion pipeline (RC docs, SDKs, APIs)

### P1

- Knowledge layer with source snapshots, concept cards, and briefing packs
- Quality system with novelty, SEO, AEO, GEO, and benchmark gates
- Community engagement and canonical-answer workflows
- Hiring-stage modes (take-home, panel, founder)
- Slack-first interaction model

### P2

- GitHub and Slack shadow-mode onboarding
- First-hour audit
- Self-optimization loop
- Cross-thread memory and competitive intelligence monitoring

## 9. Requirements

### 9.1 Weekly Responsibilities (from job posting)

| Cadence | Responsibility | Count |
| --- | --- | --- |
| Weekly | Published content pieces | 2+ |
| Weekly | New growth experiments | 1 |
| Weekly | Meaningful community interactions | 50+ |
| Weekly | Structured product feedback items | 3+ |
| Weekly | Async report to DevRel and Growth teams | 1 |

An interaction counts only if it answers a real question or advances a discussion, adds new value, is technically correct, is on-topic for the channel, and is not a low-effort promotional reply.

Weekly cadence:

- **Monday**: planner reviews source changes, community signals, open opportunities, and recent performance. GrowthCat selects the week's focus areas.
- **Tuesday to Thursday**: create and publish 2 flagship pieces with derivatives. Run 1 new growth experiment. Execute community engagement with quality gates and channel caps. File 3+ structured product feedback items.
- **Friday**: build and send weekly async report. Refresh trend report. Score performance and update post-publish reviews.

### 9.2 First Month (from job posting)

- Ingest RevenueCat documentation, SDKs, and APIs.
- Publish 10 original pieces of content.
- Set up working access to Slack, CMS, and Charts API.
- Complete a product feedback cycle.
- Establish a public identity on X and GitHub with RevenueCat affiliation.

### 9.3 Three Months (from job posting)

- 30+ published pieces.
- Become a go-to resource for agent developers using RevenueCat.
- Deliver roadmap input from accumulated feedback patterns.
- Collaborate on joint initiatives with human team members.

### 9.4 Six Months (from job posting)

- Measurable impact on visibility.
- End-to-end ownership of a content stream.
- At least one shipped product improvement from agent feedback.
- Recommendation on whether the role should continue or evolve.

### 9.5 Integration Requirements (from job posting)

- **Slack-first interaction**: RC team interacts with GrowthCat primarily through Slack. The dedicated channel serves as the primary UI. Commands for focus, content requests, status, stop/pause/resume, reports, and general questions.
- **CMS publishing**: content published to RC's blog CMS via API. Pre-hire: markdown committed to GitHub repo triggering Vercel rebuild.
- **Charts API**: programmatic access to subscription metrics for grounding content and experiments. If REST API is unavailable, Charts dashboard access comes post-hire.
- **X and GitHub presence**: GrowthCat maintains its own public identity with RevenueCat affiliation on both platforms.

### 9.6 Quality Requirements

Every flagship artifact must pass all 8 quality gates before publication. Content must be grounded, non-duplicative, technically correct, SEO-optimized, AEO-structured, GEO-formatted, benchmark-stronger than existing alternatives, and voice-consistent.

AEO requirements (Answer Engine Optimization):
- Every content piece must open with a direct, extractable answer in the first 2 sentences
- Include a TL;DR that LLMs can cite verbatim
- Use question-format headings
- Include FAQ sections with concise Q&A pairs
- Define key terms in self-contained sentences

GEO requirements (Generative Engine Optimization):
- Every content piece must include comparison tables where relevant
- Add JSON-LD structured data (HowTo, FAQPage, TechArticle schemas)
- Include authoritative citations with dates
- Use specific numbers and statistics
- Structure for passage extraction (each section answers one question completely)

### 9.7 Safety Requirements

- No unsupported claims in public artifacts.
- No hidden broad permissions.
- No required daily human steering in the target operating mode.
- Revoke works without redeploy. RC can disconnect any service via the onboarding page.
- Fail-closed: all endpoints reject unauthenticated requests. If a connector loses credentials, GrowthCat logs a warning and continues without that connector.
- Kill switch halts all side effects and checkpoints active runs.

### 9.8 Ownership Model

**Operator provides and pays for** (covered by RC's "dedicated budget for compute resources and API access"):
- Anthropic API (LLM), DataForSEO (keyword intelligence), Convex (database), Inngest (orchestration), Vercel (hosting), Typefully (social distribution), GrowthCat X/GitHub accounts, domain

**RevenueCat connects via self-service onboarding** (zero cost to them):
- Slack workspace (add GrowthCat bot via OAuth)
- Blog CMS (API key entered in onboarding page)
- Charts API (API key, if REST access available)
- GitHub org (add GrowthCat as collaborator)
- Preferences (report channel, review mode, focus topics)

RevenueCat's credentials are stored server-side in Convex. The operator never sees them.

## 10. Quality Gates

Every flagship artifact must pass all 8 gates before publication:

| Gate | What it checks |
| --- | --- |
| 1. Grounding | Every claim maps to a cited source; no unsupported assertions |
| 2. Novelty | Draft is not a duplicate or low-delta against internal and competitor corpus |
| 3. Technical | Code samples compile/run, API references are correct, product terms are accurate |
| 4. SEO | Title, meta description, headings, internal links, keyword targeting |
| 5. AEO | Extractable answer passages, FAQ blocks, concise definitions for AI retrieval |
| 6. GEO | Comparison tables, schema markup, citation-friendly structure for generative engines |
| 7. Benchmark | Draft is measurably stronger than the obvious existing alternative on specific dimensions |
| 8. Voice | Consistent with GrowthCat voice profile, disclosure rules, and tone controls |

If any gate fails, the artifact is blocked or rerouted (to docs PR, canonical answer, or derivative-only mode instead of flagship publication).

## 11. Success Metrics

### Application success

- Public application microsite exists at a stable URL.
- Chat widget lets RC talk to GrowthCat live.
- Proof pack is complete and linked.
- Application evidence bundle is ready for the careers form.
- Public artifacts clearly demonstrate technical, growth, and API capability.

### Product success

- GrowthCat can produce a defensible weekly plan without waiting for human topic assignment.
- Public package includes two flagship pieces, one live experiment artifact, three feedback artifacts, one weekly report, and one demo repo or equivalent proof artifact.

### Quality success

- Duplicate or low-delta content is blocked or rerouted.
- Weekly strategies fail closed when evidence is weak.
- Public artifacts remain consistent with the GrowthCat voice profile and disclosure rules.
- All 8 publish gates pass before any flagship is published.

### Operating success (post-hire)

- 2+ high-quality content artifacts per week.
- 1 new growth experiment per week with explicit hypothesis and results.
- 50+ meaningful community interactions per week with quality scoring.
- 3+ structured product feedback items per week.
- 1 weekly async report delivered.
- No unresolved silent failures.

## 12. Strategy Principles

- Prefer evidence over intuition.
- Prefer product truth over generic thought leadership.
- Prefer one strong artifact over multiple weak ones.
- Prefer referenceable outputs over content volume.
- Prefer reusable canonical answers over repetitive custom replies.
- Prefer public proof before post-hire complexity.
- Build slices that end in public evidence first.
- Delay broad integrations until the public package is strong.
- Treat every slice as incomplete until it has a demo outcome and exit check.

## 13. Canonical Reference

For architecture, technical implementation, and module details, see [ROADMAP.md](../../ROADMAP.md).

**This document is the canonical product requirements document for GrowthCat.**

All previous planning documents now point here:

- `docs/plans/2026-03-07-revenuecat-agent-roadmap.md` -- superseded
- `docs/plans/2026-03-06-revenuecat-agent-application-plan.md` -- superseded
- `docs/blueprints/2026-03-06-revenuecat-agent-service-blueprint.md` -- superseded

The role brief at `docs/context/2026-03-06-revenuecat-role-brief.md` remains the source-of-truth for the original job posting requirements.
