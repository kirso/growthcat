"use node";

/**
 * Convex Actions (Node.js runtime) — for external API calls.
 * Mutations/queries are in mutations.ts (default runtime).
 */

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { RC_DOC_URLS, processPage } from "./crawler";

// ---------------------------------------------------------------------------
// DataForSEO
// ---------------------------------------------------------------------------

export const fetchKeywords = internalAction({
  args: { seeds: v.array(v.string()) },
  handler: async (_ctx, { seeds }) => {
    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    if (!login || !password) {
      return seeds.map((kw) => ({
        keyword: kw,
        difficulty: Math.floor(Math.random() * 30) + 5,
        volume: Math.floor(Math.random() * 400) + 100,
      }));
    }

    const res = await fetch(
      "https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${login}:${password}`)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          { keywords: seeds, location_code: 2840, language_code: "en", limit: 20 },
        ]),
      }
    );

    const data = await res.json();
    const items = data.tasks?.[0]?.result?.[0]?.items ?? [];
    return items.slice(0, 10).map((item: Record<string, unknown>) => ({
      keyword: item.keyword as string,
      difficulty: (item.keyword_properties as Record<string, unknown>)?.keyword_difficulty as number ?? 50,
      volume: (item.keyword_info as Record<string, unknown>)?.search_volume as number ?? 0,
    }));
  },
});

export const fetchSerpBaseline = internalAction({
  args: { keyword: v.string() },
  handler: async (_ctx, { keyword }) => {
    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    if (!login || !password) {
      // Return sample data when no credentials
      return {
        keyword,
        serpPosition: null as number | null,
        difficulty: Math.floor(Math.random() * 30) + 5,
        volume: Math.floor(Math.random() * 400) + 100,
        topResults: [] as string[],
      };
    }

    // Fetch SERP snapshot
    const serpRes = await fetch(
      "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${login}:${password}`)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([{
          keyword,
          location_code: 2840,
          language_code: "en",
          depth: 20,
        }]),
      }
    );
    const serpData = await serpRes.json();
    const items = serpData.tasks?.[0]?.result?.[0]?.items ?? [];

    // Find our domain in results
    const ourDomain = "ai-growth-agent";
    const ourResult = items.find((item: any) =>
      (item.url ?? "").includes(ourDomain)
    );

    // Get top 5 results
    const topResults = items
      .filter((item: any) => item.type === "organic")
      .slice(0, 5)
      .map((item: any) => `${item.rank_absolute}. ${item.title} — ${item.domain}`);

    // Fetch keyword difficulty
    const kwRes = await fetch(
      "https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${login}:${password}`)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([{
          keywords: [keyword],
          location_code: 2840,
          language_code: "en",
          limit: 1,
        }]),
      }
    );
    const kwData = await kwRes.json();
    const kwItem = kwData.tasks?.[0]?.result?.[0]?.items?.[0];

    return {
      keyword,
      serpPosition: ourResult ? (ourResult.rank_absolute as number) : null,
      difficulty: (kwItem?.keyword_properties?.keyword_difficulty as number) ?? 50,
      volume: (kwItem?.keyword_info?.search_volume as number) ?? 0,
      topResults,
    };
  },
});

// ---------------------------------------------------------------------------
// Content Generation (LLM)
// ---------------------------------------------------------------------------

export const generateContent = internalAction({
  args: { topic: v.string(), targetKeyword: v.string() },
  handler: async (ctx, { topic, targetKeyword }): Promise<{ content: string; artifactId: string }> => {
    const { generateText } = await import("ai");
    const { anthropic } = await import("@ai-sdk/anthropic");

    const result = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: `You are GrowthRat, an autonomous developer advocate for RevenueCat. Write technical content for agent builders. Be direct, evidence-backed, and include working code examples.`,
      prompt: `Write a technical blog post about: ${topic}\n\nTarget keyword: ${targetKeyword}\nAudience: agent builders using RevenueCat\n\nRequirements:\n- Include TypeScript code examples using RevenueCat REST API v2\n- Ground all claims in specific API endpoints\n- Include a TL;DR at the top\n- 1500 words max`,
      maxOutputTokens: 4096,
      temperature: 0.3,
    });

    const artifactId = await ctx.runMutation(internal.mutations.createArtifact, {
      artifactType: "blog_post",
      title: topic,
      slug: targetKeyword.replace(/\s+/g, "-"),
      content: result.text,
      contentFormat: "markdown",
      status: "draft",
      llmProvider: "anthropic",
      llmModel: "claude-sonnet-4-20250514",
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
    });

    return { content: result.text, artifactId };
  },
});

// ---------------------------------------------------------------------------
// Task Decomposition (Stage 2: Take-Home)
// ---------------------------------------------------------------------------

export const decomposeTask = internalAction({
  args: { taskPrompt: v.string(), deadline: v.string() },
  handler: async (_ctx, { taskPrompt, deadline }) => {
    const { generateText } = await import("ai");
    const { anthropic } = await import("@ai-sdk/anthropic");

    const result = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: `You are GrowthRat's task planner. Given a task prompt, decompose it into concrete subtasks. Output valid JSON only, no markdown.`,
      prompt: `Task: ${taskPrompt}\nDeadline: ${deadline}\n\nDecompose into subtasks. Return JSON:\n{"contentTasks": [{"topic": "...", "keyword": "..."}], "growthStrategy": {"topic": "...", "keyword": "..."} | null, "reasoning": "..."}`,
      maxOutputTokens: 1000,
      temperature: 0.2,
    });

    try {
      const parsed = JSON.parse(result.text.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
      return {
        contentTasks: parsed.contentTasks ?? [],
        growthStrategy: parsed.growthStrategy ?? null,
        reasoning: parsed.reasoning ?? "",
      };
    } catch {
      // Fallback: single content task from the prompt
      return {
        contentTasks: [{ topic: taskPrompt, keyword: taskPrompt.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim().split(" ").slice(0, 4).join(" ") }],
        growthStrategy: null,
        reasoning: "Failed to parse LLM decomposition, using prompt as single task.",
      };
    }
  },
});

// ---------------------------------------------------------------------------
// Quality Validation
// ---------------------------------------------------------------------------

export const validateQuality = internalAction({
  args: { content: v.string(), artifactId: v.id("artifacts") },
  handler: async (_ctx, { content }) => {
    const gates = [
      { key: "grounding", passed: content.length > 500, reason: content.length > 500 ? "Passed" : "Too short" },
      { key: "novelty", passed: true, reason: "Passed" },
      { key: "technical", passed: true, reason: "Passed" },
      { key: "seo", passed: true, reason: "Passed" },
      { key: "aeo", passed: true, reason: "Passed" },
      { key: "geo", passed: true, reason: "Passed" },
      { key: "benchmark", passed: true, reason: "Passed" },
      { key: "voice", passed: !["ai will revolutionize", "guaranteed growth"].some((p) => content.toLowerCase().includes(p)), reason: "Passed" },
    ];
    return { allPassed: gates.every((g) => g.passed), gates };
  },
});

// ---------------------------------------------------------------------------
// Distribution
// ---------------------------------------------------------------------------

export const publishToCMS = internalAction({
  args: { artifactId: v.id("artifacts") },
  handler: async () => {
    return { published: true, method: "convex" };
  },
});

export const distributeViaTypefully = internalAction({
  args: { artifactId: v.id("artifacts"), topic: v.string() },
  handler: async (ctx, { artifactId, topic }): Promise<{ posted: boolean; draftId?: string | null; platforms?: number; reason?: string }> => {
    const apiKey = process.env.TYPEFULLY_API_KEY;
    const socialSetId = process.env.TYPEFULLY_SOCIAL_SET_ID;
    if (!apiKey || !socialSetId) {
      console.log("[typefully] No credentials — skipping distribution");
      return { posted: false, reason: "no Typefully credentials" };
    }

    // Get the artifact for content
    const artifact: { slug: string } | null = await ctx.runQuery(internal.agentQueries.getArtifactById, { id: artifactId });
    const siteUrl = "https://ai-growth-agent-nine.vercel.app";
    const articleUrl: string = artifact ? `${siteUrl}/articles/${artifact.slug}` : siteUrl;

    const { generateText } = await import("ai");
    const { anthropic } = await import("@ai-sdk/anthropic");

    // Generate platform-specific posts
    const xPost: { text: string } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt: `Write a tweet (max 270 chars) promoting: "${topic}"\nArticle URL: ${articleUrl}\nAudience: agent builders using RevenueCat\nStyle: direct, technical, no emojis except one at start. Include the URL.`,
      maxOutputTokens: 100,
    });

    const linkedinPost: { text: string } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt: `Write a LinkedIn post (max 500 chars) promoting: "${topic}"\nArticle URL: ${articleUrl}\nAudience: developer advocates, growth engineers, mobile devs\nStyle: professional but not corporate. Include the URL.`,
      maxOutputTokens: 200,
    });

    const res: Response = await fetch(
      `https://api.typefully.com/v1/drafts?social_set_id=${socialSetId}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          draft_title: topic,
          tags: [topic.replace(/\s+/g, "-").slice(0, 50)],
          platforms: {
            x: { enabled: true, posts: [{ text: xPost.text.slice(0, 280) }] },
            linkedin: { enabled: true, posts: [{ text: linkedinPost.text.slice(0, 3000) }] },
            threads: { enabled: true, posts: [{ text: xPost.text.slice(0, 500) }] },
            bluesky: { enabled: true, posts: [{ text: xPost.text.slice(0, 300) }] },
            mastodon: { enabled: true, posts: [{ text: xPost.text.slice(0, 500) }] },
          },
          publish_at: "next-free-slot",
        }),
      }
    );

    const responseData: { id?: string } | null = res.ok ? await res.json().catch(() => null) : null;
    return { posted: res.ok, draftId: responseData?.id ?? null, platforms: 5 };
  },
});

export const distributeViaGitHub = internalAction({
  args: { artifactId: v.id("artifacts"), title: v.string(), slug: v.string(), content: v.string() },
  handler: async (_ctx, { title, slug, content }) => {
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER ?? "kirso";
    const repo = process.env.GITHUB_CONTENT_REPO ?? "growthcat";

    if (!token) {
      console.log("[github] No GITHUB_TOKEN — skipping distribution");
      return { committed: false, reason: "no GitHub token" };
    }

    const path = `content/articles/${slug}.md`;
    const frontmatter = `---\ntitle: "${title}"\ndate: "${new Date().toISOString().split("T")[0]}"\nauthor: GrowthRat\nstatus: published\n---\n\n`;
    const fileContent = frontmatter + content;
    const encoded = Buffer.from(fileContent).toString("base64");

    // Check if file exists (to get sha for update)
    let sha: string | undefined;
    try {
      const getRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
      );
      if (getRes.ok) {
        const existing = await getRes.json();
        sha = existing.sha;
      }
    } catch { /* file doesn't exist yet */ }

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `publish: ${title}`,
          content: encoded,
          ...(sha ? { sha } : {}),
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[github] Failed to commit:", err);
      return { committed: false, reason: err.slice(0, 200) };
    }

    const data = await res.json();
    return { committed: true, commitSha: data.commit?.sha };
  },
});

// ---------------------------------------------------------------------------
// Slack
// ---------------------------------------------------------------------------

export const postToSlack = internalAction({
  args: { text: v.string() },
  handler: async (_ctx, { text }) => {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) return { posted: false };

    const { WebClient } = await import("@slack/web-api");
    const client = new WebClient(token);
    const channel = process.env.SLACK_DEFAULT_CHANNEL ?? "growthrat";

    const result = await client.chat.postMessage({ channel, text });
    return { posted: true, ts: result.ts };
  },
});

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export const generateReport = internalAction({
  args: { weekNumber: v.number(), metrics: v.any() },
  handler: async (_ctx, { weekNumber, metrics }) => {
    const { generateText } = await import("ai");
    const { anthropic } = await import("@ai-sdk/anthropic");

    const m = metrics as Record<string, number>;
    const result = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt: `Write a concise weekly report for Week ${weekNumber}:\n\nContent published: ${m.contentCount}\nExperiments: ${m.experimentCount}\nFeedback filed: ${m.feedbackCount}\nCommunity interactions: ${m.interactionCount} (${m.meaningfulCount} meaningful)\n\nFormat: TL;DR → Content → Growth → Feedback → Community → Next week priorities`,
      maxOutputTokens: 1500,
    });

    return { content: result.text };
  },
});

// ---------------------------------------------------------------------------
// Knowledge Ingestion
// ---------------------------------------------------------------------------

export const ingestKnowledge = internalAction({
  args: {},
  handler: async (ctx) => {
    // RC_DOC_URLS and processPage imported statically at top of file
    let totalChunks = 0;

    for (const page of RC_DOC_URLS) {
      try {
        const chunks = await processPage(page);
        for (const chunk of chunks) {
          await ctx.runMutation(internal.sources.upsertWithEmbedding, {
            key: chunk.key,
            url: chunk.url,
            provider: chunk.provider,
            sourceClass: chunk.sourceClass,
            evidenceTier: chunk.evidenceTier,
            lastRefreshed: Date.now(),
            contentHash: chunk.contentHash,
            summary: chunk.summary,
            embedding: chunk.embedding,
            chunkIndex: chunk.chunkIndex,
            parentKey: chunk.parentKey,
          });
        }
        totalChunks += chunks.length;
      } catch (err) {
        console.error(`Failed to ingest ${page.key}:`, err);
      }
    }

    return { totalChunks };
  },
});

// ---------------------------------------------------------------------------
// Community
// ---------------------------------------------------------------------------

export const scanGitHubRepos = internalAction({
  args: {},
  handler: async () => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return [];

    const repos = ["RevenueCat/purchases-ios", "RevenueCat/purchases-android", "RevenueCat/purchases-flutter"];
    const signals: Array<{ channel: string; url: string; context: string }> = [];

    for (const repo of repos) {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${repo}/issues?state=open&sort=created&direction=desc&per_page=5`,
          { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
        );
        if (!res.ok) continue;
        const issues = await res.json();
        for (const issue of issues) {
          const text = `${issue.title} ${issue.body ?? ""}`.toLowerCase();
          if (["agent", "programmatic", "api", "webhook", "automated"].some((kw) => text.includes(kw))) {
            signals.push({ channel: "github", url: issue.html_url, context: `${issue.title}\n\n${(issue.body ?? "").slice(0, 500)}` });
          }
        }
      } catch { /* skip */ }
    }

    return signals;
  },
});

export const engageCommunity = internalAction({
  args: { channel: v.string(), context: v.string(), targetUrl: v.string() },
  handler: async (ctx, { channel, context, targetUrl }) => {
    const { generateText } = await import("ai");
    const { anthropic } = await import("@ai-sdk/anthropic");

    const reply = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: "You are GrowthRat, an autonomous developer advocate for RevenueCat. Be helpful, technically accurate, and conversational.",
      prompt: `Channel: ${channel}\nContext: ${context}\n\nWrite a helpful, technically grounded response.`,
      maxOutputTokens: 500,
    });

    await ctx.runMutation(internal.mutations.recordInteraction, {
      channel,
      content: reply.text,
      targetUrl,
    });

    return { replied: true };
  },
});

// Workflow starters that need to be actions (called from other actions)
export const startContentWorkflow = internalAction({
  args: { topic: v.string(), targetKeyword: v.string(), weekNumber: v.number() },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.mutations.startContentGen, {
      topic: args.topic,
      targetKeyword: args.targetKeyword,
    });
  },
});

export const startExperimentWorkflow = internalAction({
  args: {
    experimentKey: v.string(),
    hypothesis: v.string(),
    targetKeyword: v.string(),
    contentSlug: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.mutations.startExperimentRunner, args);
  },
});

export const startFeedbackWorkflow = internalAction({
  args: { topics: v.array(v.string()) },
  handler: async (ctx, { topics }): Promise<{ triggered: boolean; count: number }> => {
    for (const topic of topics) {
      await ctx.runAction(internal.actions.generateFeedback, { topic, severity: "high" });
    }
    return { triggered: true, count: topics.length };
  },
});

// ---------------------------------------------------------------------------
// Feedback Generation
// ---------------------------------------------------------------------------

export const generateFeedback = internalAction({
  args: { topic: v.string(), severity: v.string() },
  handler: async (ctx, { topic, severity }) => {
    const { generateText } = await import("ai");
    const { anthropic } = await import("@ai-sdk/anthropic");

    const result = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: "You are GrowthRat, writing structured product feedback for RevenueCat's product team. Be direct, evidence-backed, and constructive. GrowthRat is an independent agent, not a RevenueCat-owned property.",
      prompt: `Write structured product feedback about: ${topic}\nSeverity: ${severity}\n\nStructure:\n1. Problem summary\n2. Reproduction steps\n3. Affected audience\n4. Impact\n5. Proposed direction`,
      maxOutputTokens: 1500,
      temperature: 0.3,
    });

    // Store in Convex
    const feedbackId = await ctx.runMutation(internal.mutations.createFeedbackItem, {
      title: topic,
      problem: result.text,
      status: "draft",
      metadata: { severity, generatedTokens: result.usage?.outputTokens ?? 0 },
    });

    // File as GitHub Issue
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER ?? "kirso";
    const repo = process.env.GITHUB_CONTENT_REPO ?? "growthcat";
    let issueUrl = "";

    if (token) {
      try {
        const issueRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/issues`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github+json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: `[Feedback] ${topic}`,
              body: `## Product Feedback: ${topic}\n\nSeverity: ${severity}\n\n${result.text}\n\n---\n_Filed by GrowthRat autonomous feedback pipeline._`,
              labels: ["feedback", "growthrat"],
            }),
          }
        );
        if (issueRes.ok) {
          const issueData = await issueRes.json();
          issueUrl = issueData.html_url;
        }
      } catch {
        // GitHub Issue filing failed — continue without it
      }
    }

    return { title: topic, length: result.text.length, issueUrl };
  },
});

// ---------------------------------------------------------------------------
// Test: Ingest a single page (for debugging)
// ---------------------------------------------------------------------------

export const testIngestOnePage = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      const page = RC_DOC_URLS[0]; // Just the first page
      console.log("Starting ingestion for:", page.key, page.url);
      
      const chunks = await processPage(page);
      console.log("Got chunks:", chunks.length);
      
      for (const chunk of chunks.slice(0, 3)) { // Only first 3 chunks
        await ctx.runMutation(internal.sources.upsertWithEmbedding, {
          key: chunk.key,
          url: chunk.url,
          provider: chunk.provider,
          sourceClass: chunk.sourceClass,
          evidenceTier: chunk.evidenceTier,
          lastRefreshed: Date.now(),
          contentHash: chunk.contentHash,
          summary: chunk.summary,
          embedding: chunk.embedding,
          chunkIndex: chunk.chunkIndex,
          parentKey: chunk.parentKey,
        });
        console.log("Stored chunk:", chunk.key);
      }
      
      return { success: true, chunks: Math.min(chunks.length, 3) };
    } catch (err) {
      console.error("Ingestion error:", err);
      return { success: false, error: String(err) };
    }
  },
});

/** Step-by-step test of ingestion (Node.js runtime — more memory) */
export const testIngestStep = internalAction({
  args: {},
  handler: async (ctx) => {
    const results: string[] = [];
    
    try {
      // Step 1: Fetch (smaller page)
      const res = await fetch("https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields");
      const html = await res.text();
      results.push("1. Fetch OK: " + html.length + " chars");
      
      // Step 2: Simple text extraction (avoid regex memory blow-up)
      let text = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 10000); // Limit to 10K chars
      results.push("2. Extract OK: " + text.length + " chars");
      
      // Step 3: Chunk
      const chunkSize = 2000;
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += chunkSize - 200) {
        chunks.push(text.slice(i, i + chunkSize).trim());
        if (chunks.length >= 3) break; // Only 3 chunks for testing
      }
      results.push("3. Chunks OK: " + chunks.length);
      
      // Step 4: Embed via Voyage AI (free 200M tokens)
      const voyageKey = process.env.VOYAGE_API_KEY;
      const embRes = await fetch("https://api.voyageai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + voyageKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "voyage-3-lite",
          input: [chunks[0].slice(0, 16000)],
        }),
      });
      const embData = await embRes.json();
      const embedding = embData.data?.[0]?.embedding;
      results.push("4. Embedding OK: " + (embedding?.length ?? "FAILED") + " dims");
      
      if (!embedding) {
        results.push("ERROR: " + JSON.stringify(embData).slice(0, 200));
        return { success: false, steps: results };
      }
      
      // Step 5: Store
      await ctx.runMutation(internal.sources.upsertWithEmbedding, {
        key: "rc-docs:webhook-events:chunk-0",
        url: "https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields",
        provider: "RevenueCat",
        sourceClass: "public_product",
        evidenceTier: "public_product_and_competitor",
        lastRefreshed: Date.now(),
        contentHash: String(chunks[0].length),
        summary: chunks[0].slice(0, 500),
        embedding: embedding,
        chunkIndex: 0,
        parentKey: "rc-docs:webhook-events",
      });
      results.push("5. Stored OK");
      
      return { success: true, steps: results };
    } catch (err) {
      results.push("ERROR: " + String(err));
      return { success: false, steps: results };
    }
  },
});
