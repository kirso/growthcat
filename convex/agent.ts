/**
 * GrowthCat Convex Agent Definition
 *
 * This is THE BRAIN. Every conversation (chat widget, panel console, Slack)
 * goes through this agent. It has:
 * - Persistent threads (conversation memory)
 * - RAG via contextHandler (searches sources table for RC docs)
 * - Tool calling (searchDocs, searchDataForSEO, getArticle, etc.)
 *
 * IMPORTANT: Convex Agent's built-in search only covers THREAD MESSAGES.
 * Custom knowledge (RC docs in the sources table) requires EXPLICIT retrieval
 * via the contextHandler below. This is NOT automatic.
 */

import { Agent, createTool } from "@convex-dev/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { components, internal } from "./_generated/api";
import { GROWTHCAT_VOICE_PROFILE } from "../lib/config/voice";

const SYSTEM_PROMPT = `You are ${GROWTHCAT_VOICE_PROFILE.agentName} — ${GROWTHCAT_VOICE_PROFILE.publicTagline}

Tone: ${GROWTHCAT_VOICE_PROFILE.toneTraits.join(", ")}

Recurring themes:
${GROWTHCAT_VOICE_PROFILE.recurringThemes.map((t) => `- ${t}`).join("\n")}

NEVER do these:
${GROWTHCAT_VOICE_PROFILE.forbiddenPatterns.map((f) => `- ${f}`).join("\n")}

When answering questions about RevenueCat, ALWAYS use the searchDocs tool first to find relevant documentation. Ground your answers in the retrieved docs. If you can't find relevant docs, say so honestly.

${GROWTHCAT_VOICE_PROFILE.disclosureLine}`;

export const growthCatAgent = new Agent(components.agent, {
  name: "GrowthCat",
  languageModel: anthropic.chat("claude-sonnet-4-20250514"),
  textEmbeddingModel: openai.embedding("text-embedding-3-small"),
  instructions: SYSTEM_PROMPT,

  tools: {
    searchDocs: createTool({
      description:
        "Search RevenueCat documentation and knowledge base for relevant information. " +
        "Use this tool BEFORE answering any question about RevenueCat APIs, SDKs, webhooks, " +
        "offerings, entitlements, or product features.",
      args: z.object({
        query: z.string().describe("What to search for in the RC knowledge base"),
      }),
      handler: async (ctx, { query }): Promise<string> => {
        // Vector search on the sources table
        // This searches our CUSTOM knowledge base, not thread messages
        try {
          const results = await ctx.vectorSearch("sources", "by_embedding", {
            vector: await generateEmbedding(query),
            limit: 5,
          });

          if (results.length === 0) {
            return "No relevant documentation found for this query.";
          }

          const docs = await Promise.all(
            results.map((r) => ctx.db.get(r._id))
          );

          return docs
            .filter(Boolean)
            .map(
              (d) =>
                `[${d!.provider} — ${d!.key}]:\n${d!.summary ?? "(no summary)"}`
            )
            .join("\n\n---\n\n");
        } catch {
          return "Knowledge base search is not available yet. Answering from training knowledge.";
        }
      },
    }),

    getArticle: createTool({
      description:
        "Fetch one of GrowthCat's own published articles by slug. " +
        "Use this to reference your own prior work.",
      args: z.object({
        slug: z.string().describe("The article slug"),
      }),
      handler: async (ctx, { slug }): Promise<string> => {
        const articles = await ctx.db
          .query("artifacts")
          .withIndex("by_slug", (q) => q.eq("slug", slug))
          .first();

        if (!articles) return `No article found with slug "${slug}".`;
        return `Title: ${articles.title}\n\n${articles.content.slice(0, 2000)}`;
      },
    }),

    getWeeklyMetrics: createTool({
      description: "Get aggregated metrics for the current week.",
      args: z.object({}),
      handler: async (ctx): Promise<string> => {
        const report = await ctx.db
          .query("weeklyReports")
          .order("desc")
          .first();

        if (!report) return "No weekly report data available yet.";
        return `Week ${report.weekNumber}: ${report.contentCount} content, ${report.experimentCount} experiments, ${report.feedbackCount} feedback, ${report.interactionCount} interactions.`;
      },
    }),
  },

  // Thread message search options (searches THREAD HISTORY, not custom docs)
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

  // CRITICAL: contextHandler injects custom knowledge BEFORE every LLM call.
  // Without this, the agent only searches thread messages, NOT the sources table.
  contextHandler: async (ctx, args) => {
    // Extract the user's latest message for RAG query
    const lastUserMessage =
      args.inputPrompt?.[0]?.content ??
      (args.inputMessages ?? [])
        .filter((m) => m.role === "user")
        .pop()?.content ??
      "";

    const query =
      typeof lastUserMessage === "string"
        ? lastUserMessage
        : JSON.stringify(lastUserMessage);

    // Search custom knowledge base (sources table) for relevant docs
    let docContext: Array<{ role: "system"; content: string }> = [];
    if (query.length > 5) {
      try {
        const embedding = await generateEmbedding(query);
        const results = await ctx.vectorSearch("sources", "by_embedding", {
          vector: embedding,
          limit: 3,
        });

        const docs = await Promise.all(
          results.map((r) => ctx.db.get(r._id))
        );

        if (docs.some(Boolean)) {
          const docText = docs
            .filter(Boolean)
            .map((d) => `[${d!.provider} — ${d!.key}]: ${d!.summary ?? ""}`)
            .join("\n");

          docContext = [
            {
              role: "system" as const,
              content: `Relevant RevenueCat documentation:\n\n${docText}\n\nUse this context to ground your response.`,
            },
          ];
        }
      } catch {
        // Knowledge base not yet populated — fall through gracefully
      }
    }

    // Return: custom doc context + search results + recent messages + input
    return [
      ...docContext,
      ...args.search,
      ...args.recent,
      ...args.inputMessages,
      ...args.inputPrompt,
      ...args.existingResponses,
    ];
  },

  callSettings: {
    maxRetries: 3,
    temperature: 0.4,
  },
  maxSteps: 5,
});

/**
 * Generate an embedding for a text query.
 * Uses OpenAI text-embedding-3-small (1536 dimensions).
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY required for embeddings");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  const data = await response.json();
  return data.data[0].embedding;
}

// Export for use in other Convex files
export { generateEmbedding };
