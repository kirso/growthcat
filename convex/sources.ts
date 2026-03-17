import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("sources").collect();
  },
});

export const upsert = mutation({
  args: {
    key: v.string(),
    url: v.optional(v.string()),
    provider: v.string(),
    sourceClass: v.string(),
    evidenceTier: v.string(),
    lastRefreshed: v.number(),
    contentHash: v.string(),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Look for an existing source with the same key
    const existing = await ctx.db
      .query("sources")
      .filter((q) => q.eq(q.field("key"), args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }

    return await ctx.db.insert("sources", args);
  },
});

// VS-A1: Upsert a source chunk WITH embedding (for knowledge ingestion)
export const upsertWithEmbedding = mutation({
  args: {
    key: v.string(),
    url: v.optional(v.string()),
    provider: v.string(),
    sourceClass: v.string(),
    evidenceTier: v.string(),
    lastRefreshed: v.number(),
    contentHash: v.string(),
    summary: v.optional(v.string()),
    embedding: v.optional(v.array(v.float64())),
    chunkIndex: v.optional(v.number()),
    parentKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sources")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      // Skip if content hasn't changed
      if (existing.contentHash === args.contentHash) {
        return existing._id;
      }
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }

    return await ctx.db.insert("sources", args);
  },
});

// Internal mutation triggered by the daily source freshness cron job
export const auditFreshness = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("[cron] auditFreshness: checking source freshness");

    const sources = await ctx.db.query("sources").collect();
    const now = Date.now();
    const staleThresholdMs = 7 * 24 * 60 * 60 * 1000; // 7 days

    let staleCount = 0;
    for (const source of sources) {
      const age = now - source.lastRefreshed;
      if (age > staleThresholdMs) {
        staleCount++;
        console.log(
          `[cron] auditFreshness: STALE source "${source.key}" (provider=${source.provider}, last refreshed ${Math.floor(age / (24 * 60 * 60 * 1000))} days ago)`
        );
      }
    }

    console.log(
      `[cron] auditFreshness: ${staleCount} stale out of ${sources.length} total sources`
    );

    // TODO: send Slack notification if stale sources found
    // TODO: trigger automatic refresh for stale sources
  },
});
