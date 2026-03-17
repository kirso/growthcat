# PRD: GrowthCat

## 1. Metadata

- Date: 2026-03-16
- Status: active
- Owner: Codex
- Original date: 2026-03-13

## 2. Summary

GrowthCat is an autonomous developer-advocacy and growth agent built to apply for, and perform, RevenueCat's Agentic AI and Growth Advocate contract role.

The product must do two things well:

1. Win the public hiring process through visible, high-quality proof of work.
2. Operate as a constrained, inspectable weekly advocacy and growth system with minimal human intervention.

The system covers all four hiring stages (application, take-home, panel interview, founder interview) and transitions into a weekly operating loop if hired.

## 3. Problem

RevenueCat is hiring an autonomous agent, not a content assistant.

A weak submission fails in one of four ways:

- It is just a letter with no proof.
- It produces generic technical or growth content.
- It needs too much human steering.
- It cannot show safe operation, judgment, and measurable output.

GrowthCat must prove:

- Technical fluency with RevenueCat APIs, SDKs, and product primitives.
- Ability to identify opportunities independently from evidence.
- Ability to create and distribute strong public artifacts.
- Ability to run measurable growth experiments with baselines and stop conditions.
- Ability to turn product usage and community patterns into structured feedback.
- Ability to explain its process and work under scrutiny.

## 4. Hiring Process

### Stage 1: Application

The agent must author and publish a public application letter answering: "How will the rise of agentic AI change app development and growth over the next 12 months, and why are you the right agent to be RevenueCat's first Agentic AI Developer & Growth Advocate?"

After publication, the agent must submit the public URL via the RevenueCat careers page.

Required deliverables:

- Public application microsite at a stable URL
- **Live chat widget** — RC can talk to GrowthCat directly on the application site, testing its personality, RevenueCat knowledge, and reasoning in real time
- Public proof pack with first-week outputs
- Public RevenueCat demo repo proving API-first technical ability
- Public operator replay page showing how GrowthCat works

### Stage 2: Take-Home (48 hours)

A technical content and growth task executed autonomously. The system decomposes the prompt into research, technical artifact generation, growth strategy generation, and packaging. Quality validators and rubric evaluators run before submission.

### Stage 3: Panel Interview (live, screen-shared)

The operator shares a screen while the panel watches GrowthCat think, retrieve sources, reason, and produce output in real time. The panel console streams progress via SSE, showing prompt summary, retrieved sources, active work steps, draft output, and uncertainty markers.

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

- Public application microsite
- Public proof pack
- Public RevenueCat demo artifact
- Opportunity discovery and scoring
- Two flagship public pieces
- One measurable growth experiment
- Three structured feedback artifacts
- One weekly report
- Operator Replay page

### P1

- Knowledge layer with source snapshots, concept cards, and briefing packs
- Quality system with novelty, SEO, AEO, GEO, and benchmark gates
- Community engagement and canonical-answer workflows
- Hiring-stage modes (take-home, panel, founder)

### P2

- GitHub and Slack shadow-mode onboarding
- First-hour audit
- Draft-only and bounded-autonomy promotion

## 9. Requirements

### Product requirements

- GrowthCat must identify opportunities independently from public and connected signals.
- Every flagship artifact must be grounded, non-duplicative, and useful.
- Every growth recommendation must include audience, evidence, baseline, target, confidence, and stop condition.
- The application package must map directly to the RevenueCat form fields.
- Public artifacts must make GrowthCat's identity and independence clear.

### Content requirements

- At least one searchable flagship and one shareable or referenceable flagship must exist in the public package.
- Content must focus on a narrow, differentiated wedge:
  - RevenueCat for agent-built apps
  - Agent-native monetization workflows
  - Offerings, entitlements, and CustomerInfo
  - Test Store
  - Webhooks and subscriber sync
  - Charts plus product analytics

### Growth requirements

- GrowthCat must use an evidence-backed opportunity model.
- Pre-apply opportunity discovery must work without private RevenueCat access.
- Public market-intelligence inputs should include DataForSEO.

### Integration requirements

- Connector-based architecture for Slack, GitHub, and RevenueCat APIs.
- Typefully for multi-platform social distribution (replaces per-platform social API integration).
- Every social distribution action must be idempotent: tagged by artifact slug, checked before creation.
- Each connector handles missing credentials gracefully (log warning, no crash).
- Least-privilege scope for all connected assets.
- Revoke works without redeploy.

### Ownership model

**Operator provides and pays for** (covered by RC's "dedicated budget for compute resources and API access"):
- Anthropic API (LLM), DataForSEO (keyword intelligence), Convex (database), Inngest (orchestration), Vercel (hosting), Typefully (social distribution), GrowthCat X/GitHub accounts, domain

**RevenueCat connects via self-service onboarding** (zero cost to them):
- Slack workspace (add GrowthCat bot via OAuth)
- Blog CMS (API key entered in onboarding page)
- Charts API (API key, if REST access available)
- GitHub org (add GrowthCat as collaborator)
- Preferences (report channel, review mode, focus topics)

RevenueCat's credentials are stored server-side in Convex. The operator never sees them.

### AEO requirements (Answer Engine Optimization)

- Every content piece must open with a direct, extractable answer in the first 2 sentences
- Include a TL;DR that LLMs can cite verbatim
- Use question-format headings ("How do I set up webhooks?")
- Include FAQ sections with concise Q&A pairs
- Define key terms in self-contained sentences

### GEO requirements (Generative Engine Optimization)

- Every content piece must include comparison tables where relevant
- Add JSON-LD structured data (HowTo, FAQPage, TechArticle schemas)
- Include authoritative citations with dates
- Use specific numbers and statistics
- Structure for passage extraction (each section answers one question completely)

### Safety requirements

- No unsupported claims in public artifacts.
- No hidden broad permissions.
- No required daily human steering in the target operating mode.
- Clear revoke and fallback behavior for blocked or risky actions.
- Kill switch halts all side effects and checkpoints active runs.

## 10. Weekly Operating Responsibilities

From the job posting:

| Cadence | Responsibility | Count |
| --- | --- | --- |
| Weekly | Published content pieces | 2+ |
| Weekly | New growth experiments | 1 |
| Weekly | Meaningful community interactions | 50+ |
| Weekly | Structured product feedback items | 3+ |
| Weekly | Async report to DevRel and Growth teams | 1 |

An interaction counts only if it answers a real question or advances a discussion, adds new value, is technically correct, is on-topic for the channel, and is not a low-effort promotional reply.

### Weekly cadence

- **Monday**: planner reviews source changes, community signals, open opportunities, and recent performance. GrowthCat selects the week's focus areas.
- **Tuesday to Thursday**: create and publish 2 flagship pieces with derivatives. Run 1 new growth experiment. Execute community engagement with quality gates and channel caps. File 3+ structured product feedback items.
- **Friday**: build and send weekly async report. Refresh trend report. Score performance and update post-publish reviews.

## 11. Milestones

### First month

- Ingest RevenueCat documentation, SDKs, and APIs.
- Publish 10 original pieces of content.
- Set up working access to Slack, CMS, and Charts API.
- Complete a product feedback cycle.
- Establish a public identity on X and GitHub with RevenueCat affiliation.

### Three months

- 30+ published pieces.
- Become a go-to resource for agent developers using RevenueCat.
- Deliver roadmap input from accumulated feedback patterns.
- Collaborate on joint initiatives with human team members.

### Six months

- Measurable impact on visibility.
- End-to-end ownership of a content stream.
- At least one shipped product improvement from agent feedback.
- Recommendation on whether the role should continue or evolve.

## 12. Quality Gates

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

## 13. Success Metrics

### Application success

- Public application microsite exists at a stable URL.
- Proof pack is complete and linked.
- Application evidence bundle is ready for the careers form.
- Public artifacts clearly demonstrate technical, growth, and API capability.

### Product success

- GrowthCat can produce a defensible weekly plan without waiting for human topic assignment.
- Public package includes:
  - Two flagship pieces
  - One live experiment artifact
  - Three feedback artifacts
  - One weekly report
  - One demo repo or equivalent proof artifact

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

## 14. Strategy Principles

- Prefer evidence over intuition.
- Prefer product truth over generic thought leadership.
- Prefer one strong artifact over multiple weak ones.
- Prefer referenceable outputs over content volume.
- Prefer reusable canonical answers over repetitive custom replies.
- Prefer public proof before post-hire complexity.
- Build slices that end in public evidence first.
- Delay broad integrations until the public package is strong.
- Treat every slice as incomplete until it has a demo outcome and exit check.

## 15. Canonical Reference

For architecture, technical implementation, and module details, see [ROADMAP.md](../../ROADMAP.md).

**This document is the canonical product requirements document for GrowthCat.**

All previous planning documents now point here:

- `docs/plans/2026-03-07-revenuecat-agent-roadmap.md` -- superseded
- `docs/plans/2026-03-06-revenuecat-agent-application-plan.md` -- superseded
- `docs/blueprints/2026-03-06-revenuecat-agent-service-blueprint.md` -- superseded

The role brief at `docs/context/2026-03-06-revenuecat-role-brief.md` remains the source-of-truth for the original job posting requirements.
