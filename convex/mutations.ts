/**
 * Convex Mutations + Queries — run in default (edge) runtime.
 * These handle database reads/writes. No Node.js APIs.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// ---------------------------------------------------------------------------
// Scoring + Planning
// ---------------------------------------------------------------------------

export const scorePlan = internalMutation({
  args: { keywords: v.any(), weekNumber: v.number() },
  handler: async (ctx, { keywords, weekNumber }) => {
    const scored = (keywords as Array<{ keyword: string; difficulty: number; volume: number }>)
      .map((kw) => ({
        ...kw,
        score: Math.round(
          (((100 - kw.difficulty) / 100) * 0.4 +
            (Math.min(kw.volume, 1000) / 1000) * 0.3 +
            (kw.keyword.includes("revenuecat") ? 0.3 : 0.1)) * 100
        ) / 100,
      }))
      .sort((a, b) => b.score - a.score);

    for (const opp of scored) {
      await ctx.db.insert("opportunitySnapshots", {
        slug: opp.keyword.replace(/\s+/g, "-"),
        title: opp.keyword,
        lane: "flagship_searchable",
        audience: "agent builders",
        score: opp.score,
        components: { difficulty: opp.difficulty, volume: opp.volume },
        rationale: `Score ${opp.score} — difficulty ${opp.difficulty}, volume ${opp.volume}`,
        readinessScore: opp.score,
        readinessPasses: opp.score >= 0.5,
      });
    }

    return {
      contentTopics: scored.slice(0, 2).map((s) => s.keyword),
      experimentTopic: scored[2]?.keyword ?? "content format test",
      feedbackTopics: ["agent onboarding", "charts api", "webhook testing"],
      communityTarget: 50,
    };
  },
});

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

export const createArtifact = internalMutation({
  args: {
    artifactType: v.string(),
    title: v.string(),
    slug: v.string(),
    content: v.string(),
    contentFormat: v.string(),
    status: v.string(),
    llmProvider: v.optional(v.string()),
    llmModel: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("artifacts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("artifacts", args);
  },
});

export const updateArtifactStatus = internalMutation({
  args: { id: v.id("artifacts"), status: v.string() },
  handler: async (ctx, { id, status }) => {
    await ctx.db.patch(id, {
      status,
      ...(status === "published" ? { publishedAt: Date.now() } : {}),
    });
  },
});

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export const gatherWeeklyMetrics = internalQuery({
  args: {},
  handler: async (ctx) => {
    const artifacts = await ctx.db.query("artifacts").collect();
    const experiments = await ctx.db.query("experiments").collect();
    const feedback = await ctx.db.query("feedbackItems").collect();
    const interactions = await ctx.db.query("communityInteractions").collect();

    return {
      contentCount: artifacts.filter((a) => a.status === "published").length,
      experimentCount: experiments.filter((e) => e.status === "running").length,
      feedbackCount: feedback.length,
      interactionCount: interactions.length,
      meaningfulCount: interactions.filter((i) => i.meaningful).length,
    };
  },
});

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export const saveWeeklyReport = internalMutation({
  args: { weekNumber: v.number(), metrics: v.any(), content: v.string() },
  handler: async (ctx, { weekNumber, metrics, content }) => {
    const m = metrics as Record<string, number>;
    const existing = await ctx.db
      .query("weeklyReports")
      .withIndex("by_week", (q) => q.eq("weekNumber", weekNumber))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        contentCount: m.contentCount ?? 0,
        experimentCount: m.experimentCount ?? 0,
        feedbackCount: m.feedbackCount ?? 0,
        interactionCount: m.interactionCount ?? 0,
        reportContent: content,
      });
      return existing._id;
    }

    return await ctx.db.insert("weeklyReports", {
      weekNumber,
      contentCount: m.contentCount ?? 0,
      experimentCount: m.experimentCount ?? 0,
      feedbackCount: m.feedbackCount ?? 0,
      interactionCount: m.interactionCount ?? 0,
      reportContent: content,
    });
  },
});

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export const createFeedbackItem = internalMutation({
  args: {
    title: v.string(),
    problem: v.string(),
    status: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("feedbackItems", args);
  },
});

// ---------------------------------------------------------------------------
// Community
// ---------------------------------------------------------------------------

export const recordInteraction = internalMutation({
  args: { channel: v.string(), content: v.string(), targetUrl: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("communityInteractions", {
      ...args,
      interactionType: "reply",
      qualityScore: 0.7,
      meaningful: true,
    });
  },
});

// ---------------------------------------------------------------------------
// Workflow Starters (called by crons → start Convex Workflows)
// Static imports only — Convex does not support dynamic import()
// ---------------------------------------------------------------------------

import { workflow } from "./workflows/index";

export const startWeeklyPlan = internalMutation({
  args: {},
  handler: async (ctx) => {
    const weekNumber = Math.ceil(
      (Date.now() - new Date("2026-03-16").getTime()) / (7 * 24 * 60 * 60 * 1000)
    ) + 1;
    await workflow.start(ctx, internal.workflows.index.weeklyPlanWorkflow, { weekNumber });
  },
});

export const startWeeklyReport = internalMutation({
  args: {},
  handler: async (ctx) => {
    const weekNumber = Math.ceil(
      (Date.now() - new Date("2026-03-16").getTime()) / (7 * 24 * 60 * 60 * 1000)
    ) + 1;
    await workflow.start(ctx, internal.workflows.index.weeklyReportWorkflow, { weekNumber });
  },
});

export const startCommunityMonitor = internalMutation({
  args: {},
  handler: async (ctx) => {
    await workflow.start(ctx, internal.workflows.index.communityMonitorWorkflow, {});
  },
});

export const startKnowledgeIngest = internalMutation({
  args: {},
  handler: async (ctx) => {
    await workflow.start(ctx, internal.workflows.index.knowledgeIngestWorkflow, {});
  },
});

export const startContentGen = internalMutation({
  args: { topic: v.string(), targetKeyword: v.string() },
  handler: async (ctx, args) => {
    await workflow.start(ctx, internal.workflows.index.contentGenWorkflow, args);
  },
});
