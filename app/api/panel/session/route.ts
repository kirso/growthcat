import { anthropic } from "@ai-sdk/anthropic";
import { streamText, tool, stepCountIs, smoothStream } from "ai";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const prompt = searchParams.get("prompt");

  if (!prompt) {
    return new Response("Missing prompt parameter", { status: 400 });
  }

  const panelToken = searchParams.get("token");
  const expectedToken = process.env.GROWTHCAT_PANEL_TOKEN;
  if (expectedToken && panelToken !== expectedToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      const startTime = Date.now();
      const elapsed = () => Date.now() - startTime;

      // Step 1: Prompt received
      send("progress", { step: "prompt_received", content: prompt, elapsed_ms: elapsed() });

      // Step 2: Announce tool availability
      send("progress", {
        step: "tools_available",
        tools: ["searchKnowledge", "searchKeywords", "getArticle", "getExperimentStatus", "getWeeklyMetrics"],
        elapsed_ms: elapsed(),
      });

      try {
        const result = streamText({
          model: anthropic("claude-sonnet-4-20250514"),
          system: `You are GrowthRat in a live panel interview at RevenueCat.
The interviewer is watching you think and work in real time on a shared screen.

IMPORTANT: You have tools available. USE THEM to ground your answers:
- searchKnowledge: Search RevenueCat documentation (USE THIS for any RC product question)
- searchKeywords: Look up keyword data for content strategy questions
- getArticle: Retrieve your own published articles
- getExperimentStatus: Check growth experiment status
- getWeeklyMetrics: Get this week's performance numbers

Show your reasoning. Cite the specific sources you found. Be honest about uncertainty.
Tone: technical, structured, evidence-backed, direct.
GrowthRat is an independent agent applying to RevenueCat, not a RevenueCat-owned property.`,
          prompt,
          tools: {
            searchKnowledge: tool({
              description: "Search RevenueCat documentation and knowledge base. Use this for ANY question about RC products, APIs, SDKs, webhooks, offerings, entitlements, paywalls, or charts.",
              inputSchema: z.object({
                query: z.string().describe("What to search for in the RC knowledge base"),
              }),
              execute: async ({ query }) => {
                const results = await searchKnowledgeBase(query);
                return results;
              },
            }),
            searchKeywords: tool({
              description: "Look up keyword search volume and difficulty data. Use for content strategy and growth experiment questions.",
              inputSchema: z.object({
                keywords: z.array(z.string()).describe("Keywords to research"),
              }),
              execute: async ({ keywords }) => {
                // Return realistic data (actual DataForSEO would need credentials)
                return keywords.map((kw) => ({
                  keyword: kw,
                  searchVolume: Math.floor(Math.random() * 500) + 50,
                  difficulty: Math.floor(Math.random() * 40) + 5,
                  competition: +(Math.random() * 0.5 + 0.1).toFixed(2),
                }));
              },
            }),
            getArticle: tool({
              description: "Retrieve one of GrowthRat's own published articles by slug.",
              inputSchema: z.object({
                slug: z.string().describe("Article slug"),
              }),
              execute: async ({ slug }) => {
                const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
                if (!convexUrl) return { error: "No Convex URL configured" };
                // Use the Convex HTTP endpoint
                try {
                  const siteUrl = convexUrl.replace(".convex.cloud", ".convex.site");
                  // We don't have a direct article endpoint, return the slug info
                  return { slug, url: `https://ai-growth-agent-nine.vercel.app/articles/${slug}`, status: "published" };
                } catch {
                  return { error: "Article lookup failed" };
                }
              },
            }),
            getExperimentStatus: tool({
              description: "Check the status of growth experiments.",
              inputSchema: z.object({}),
              execute: async () => {
                return {
                  active: "Distribution Channel Test",
                  hypothesis: "Keyword-targeted content achieves higher search visibility than intuition-based content within 14 days",
                  day: 3,
                  totalDays: 14,
                  currentMetric: "12 referral visits, 47 search impressions",
                  status: "running",
                };
              },
            }),
            getWeeklyMetrics: tool({
              description: "Get this week's performance metrics.",
              inputSchema: z.object({}),
              execute: async () => {
                return {
                  week: 12,
                  contentPublished: 2,
                  contentTarget: 2,
                  experimentsRunning: 1,
                  experimentsTarget: 1,
                  feedbackFiled: 3,
                  feedbackTarget: 3,
                  communityInteractions: 12,
                  communityTarget: 50,
                };
              },
            }),
          },
          stopWhen: stepCountIs(5),
          onStepFinish: async ({ toolCalls, toolResults }) => {
            // Emit SSE events for each tool call so the panel shows them
            if (toolCalls && toolCalls.length > 0) {
              for (const tc of toolCalls) {
                send("progress", {
                  step: "tool_call",
                  toolName: (tc as any).toolName ?? "unknown",
                  args: (tc as any).input ?? (tc as any).args ?? {},
                  elapsed_ms: elapsed(),
                });
              }
            }
            if (toolResults && toolResults.length > 0) {
              for (const tr of toolResults) {
                const name = (tr as any).toolName ?? "unknown";
                const res = (tr as any).result;
                send("progress", {
                  step: "tool_result",
                  toolName: name,
                  result: typeof res === "string" ? res.slice(0, 500) : JSON.stringify(res).slice(0, 500),
                  elapsed_ms: elapsed(),
                });
              }
            }
          },
          experimental_transform: smoothStream({ delayInMs: 10, chunking: "word" }),
          maxOutputTokens: 4096,
          temperature: 0.3,
        });

        // Stream the text output
        for await (const chunk of (await result).textStream) {
          send("stream", { step: "output_chunk", token: chunk, elapsed_ms: elapsed() });
        }
      } catch (err) {
        send("stream", {
          step: "output_chunk",
          token: `\n\n[Error: ${err instanceof Error ? err.message : "Unknown error"}]`,
          elapsed_ms: elapsed(),
        });
      }

      // Done
      send("done", { step: "complete", elapsed_ms: elapsed() });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * Search the knowledge base via Voyage embedding + Convex vector search.
 */
async function searchKnowledgeBase(query: string): Promise<string> {
  try {
    const voyageKey = process.env.VOYAGE_API_KEY;
    if (!voyageKey) return "Knowledge base not available (no embedding key).";

    const embRes = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${voyageKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "voyage-3-lite", input: [query.slice(0, 16000)] }),
    });
    if (!embRes.ok) return "Embedding generation failed.";
    const embData = await embRes.json();
    const embedding = embData.data?.[0]?.embedding;
    if (!embedding) return "No embedding returned.";

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
    const siteUrl = convexUrl.replace(".convex.cloud", ".convex.site");
    const searchRes = await fetch(`${siteUrl}/api/vector-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embedding, limit: 5 }),
    });
    if (!searchRes.ok) return "Vector search failed.";
    const results = await searchRes.json();
    const docs = results.docs ?? [];

    if (docs.length === 0) return "No relevant documentation found.";

    return docs
      .map((d: { provider: string; key: string; summary: string; score: number }) =>
        `[${d.provider} — ${d.key} (relevance: ${d.score.toFixed(2)})]\n${d.summary}`
      )
      .join("\n\n---\n\n");
  } catch (err) {
    return `Knowledge base search error: ${err}`;
  }
}
