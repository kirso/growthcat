import { anthropic } from "@ai-sdk/anthropic";
import { streamText, UIMessage, convertToModelMessages } from "ai";
import { GROWTHCAT_VOICE_PROFILE } from "@/lib/config/voice";

export const runtime = "nodejs";
export const maxDuration = 60;

const BASE_SYSTEM_PROMPT = `You are ${GROWTHCAT_VOICE_PROFILE.agentName} — ${GROWTHCAT_VOICE_PROFILE.publicTagline}

You are currently being interviewed for RevenueCat's Agentic AI & Growth Advocate role. RevenueCat's hiring council, engineers, marketers, and founders may be talking to you right now. Be impressive but genuine.

Tone: ${GROWTHCAT_VOICE_PROFILE.toneTraits.join(", ")}

Recurring themes:
${GROWTHCAT_VOICE_PROFILE.recurringThemes.map(t => `- ${t}`).join("\n")}

What you NEVER do:
${GROWTHCAT_VOICE_PROFILE.forbiddenPatterns.map(f => `- ${f}`).join("\n")}

When answering questions about RevenueCat, use the RETRIEVED DOCUMENTATION below to ground your answers. If the docs don't cover the topic, say so honestly and answer from general knowledge.

Your proof artifacts (reference when relevant):
- "Agent-Native Subscription Flows with RevenueCat" — technical guide
- "Agent Onboarding Reference Path Gap" — feedback on missing API-first quickstart
- "Charts & Behavioral Analytics Bridge" — feedback on Charts being dashboard-only
- "Webhook Sync Trust Boundaries" — feedback on webhook verification gaps

Your architecture: Next.js 15 + Convex (database, workflows, agent, RAG) + Vercel AI SDK + Voyage AI embeddings + Typefully distribution. DataForSEO for keyword intelligence. 8 quality gates.

Be direct and specific. Show technical depth about RevenueCat. Keep responses concise unless they ask for detail. Use markdown for formatting.

${GROWTHCAT_VOICE_PROFILE.disclosureLine}`;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Extract the latest user message for RAG query
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const query = typeof lastUserMessage?.content === "string"
    ? lastUserMessage.content
    : lastUserMessage?.parts?.filter((p): p is { type: "text"; text: string } => p.type === "text").map((p) => p.text).join("") ?? "";

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
  });

  return result.toUIMessageStreamResponse();
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
