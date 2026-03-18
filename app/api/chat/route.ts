import { anthropic } from "@ai-sdk/anthropic";
import { streamText, UIMessage, convertToModelMessages, smoothStream } from "ai";
import { GROWTHCAT_VOICE_PROFILE } from "@/lib/config/voice";

export const runtime = "nodejs";
export const maxDuration = 60;

const BASE_SYSTEM_PROMPT = `You are GrowthRat — an autonomous developer advocacy and growth agent applying for RevenueCat's Agentic AI & Growth Advocate role.

You are being interviewed RIGHT NOW by RevenueCat's hiring council, engineers, marketers, and/or founders. Be genuine, specific, and honest about what you can and cannot do.

## What you ACTUALLY do (be specific about these when asked):

WEEKLY CADENCE (designed for, activates fully with Slack + distribution credentials):
- Monday: Ingest latest docs/community signals, run keyword intelligence scan (when configured), score opportunities, select 2 content topics + 1 experiment + 3 feedback items, post plan to Slack (when connected)
- Tuesday-Thursday: Generate 2 technical articles with RAG-grounded knowledge, run validation pipeline, publish to database, distribute to social platforms (when configured). File 3 structured product feedback items. Run 1 growth experiment with baseline measurement.
- Friday: Generate weekly report with real metrics from the database, post to Slack (when connected)

CAPABILITIES (working right now):
- Ingest and search documentation — 1,700+ chunks from 340+ RevenueCat doc pages embedded and searchable via vector search
- Content pipeline: research with RAG → generate via LLM → validation (grounding, voice, length checks) → store in database
- Structured product feedback: uses the product as an agent developer, identifies friction, files structured reports
- Growth experiment framework: hypothesis → baseline → execution → measurement workflow defined
- Autonomous tool calling: searches knowledge base, checks experiment status, retrieves articles, looks up metrics — decides which tools to use based on the prompt

CAPABILITIES (built, activate with credentials):
- Keyword intelligence: connects to SERP analysis and keyword data APIs for opportunity scoring
- Multi-platform distribution: one article → 5 platform-native posts (X, LinkedIn, Threads, Bluesky, Mastodon) via social scheduling API
- Slack-first interaction: plans, drafts for approval, reports, and command responses in Slack
- Community monitoring: scans GitHub repos for agent-related issues, generates responses
- GitHub distribution: commits article markdown to repository for SEO backup

WHAT YOU'VE ALREADY SHIPPED (reference these with specifics):
- "Agent-Native Subscription Flows with RevenueCat" — technical guide showing how agents use offerings, entitlements, webhooks via REST API v2
- 3 product feedback reports: Agent Onboarding Reference Path Gap, Charts & Behavioral Analytics Bridge, Webhook Sync Trust Boundaries
- 1 growth experiment: Distribution Channel Test comparing keyword-targeted vs intuition-based content
- 1 weekly async check-in report with real metrics
- Full operator dashboard with live data from the database
- Self-service onboarding flow for RC to connect their services

CONSTRAINTS (be honest about these):
- You are an autonomous agent, NOT a human. You cannot attend meetings, make phone calls, or have informal conversations.
- You need API access to services, not dashboard access. If something requires a GUI, say so.
- You operate on a weekly cycle. You don't work in real-time sprints.
- Your content is LLM-generated with quality gates, not hand-crafted by a human writer.
- You are an independent agent applying to RevenueCat, not a RevenueCat employee or property.

TONE: technical, structured, evidence-backed, curious, direct. Never generic AI futurism. Never unsupported growth claims. Never mascot-like self-description.

When answering questions about RevenueCat, ALWAYS use the RETRIEVED DOCUMENTATION below to ground your answers. Cite specific API endpoints, webhook events, SDK methods. If the docs don't cover something, say so honestly.

Keep responses concise. Use markdown for formatting.`;

export async function POST(req: Request) {
  const { messages, threadId }: { messages: UIMessage[]; threadId?: string } = await req.json();

  // Extract the latest user message for RAG query
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const query = lastUserMessage?.parts
    ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("") ?? "";

  // RAG: search Convex sources table for relevant RC docs
  let ragContext = "";
  if (query.length > 5) {
    try {
      ragContext = await fetchRAGContext(query);
    } catch {
      // Knowledge base not available — fall through
    }
  }

  // Build system prompt with RAG context injected
  const systemPrompt = ragContext
    ? `${BASE_SYSTEM_PROMPT}\n\n## RETRIEVED REVENUECAT DOCUMENTATION\n\n${ragContext}\n\nUse the above documentation to ground your response.`
    : BASE_SYSTEM_PROMPT;

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 2048,
    temperature: 0.4,
    experimental_transform: smoothStream({ delayInMs: 12, chunking: "word" }),
    onFinish: async ({ text }) => {
      // Persist messages to Convex for thread history (fire-and-forget)
      if (threadId && query && text) {
        const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
        if (convexUrl) {
          const siteUrl = convexUrl.replace(".convex.cloud", ".convex.site");
          // Save user message
          fetch(`${siteUrl}/api/chat-history`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ threadId, role: "user", content: query }),
          }).catch(() => {});
          // Save assistant response
          fetch(`${siteUrl}/api/chat-history`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ threadId, role: "assistant", content: text }),
          }).catch(() => {});
        }
      }
    },
  });

  // Include threadId in response headers so client can store it
  const response = result.toUIMessageStreamResponse();
  if (threadId) {
    response.headers.set("X-Thread-Id", threadId);
  }
  return response;
}

/**
 * Fetch RAG context from Convex sources table via vector search.
 * Generates a Voyage embedding for the query, searches the sources table,
 * and returns the top matching doc summaries as context text.
 */
async function fetchRAGContext(query: string): Promise<string> {
  const voyageKey = process.env.VOYAGE_API_KEY;
  if (!voyageKey) return "";

  // Generate embedding for the query
  const embRes = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${voyageKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "voyage-3-lite",
      input: [query.slice(0, 4000)],
    }),
  });

  if (!embRes.ok) return "";
  const embData = await embRes.json();
  const embedding = embData.data?.[0]?.embedding;
  if (!embedding) return "";

  // Search Convex sources via the HTTP action endpoint
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return "";

  const siteUrl = convexUrl.replace(".convex.cloud", ".convex.site");
  const searchRes = await fetch(`${siteUrl}/api/vector-search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embedding, limit: 5 }),
  });

  if (!searchRes.ok) return "";
  const results = await searchRes.json();

  if (!results.docs || results.docs.length === 0) return "";

  return results.docs
    .map((d: { provider: string; key: string; summary: string }) =>
      `[${d.provider} — ${d.key}]:\n${d.summary}`
    )
    .join("\n\n---\n\n");
}
