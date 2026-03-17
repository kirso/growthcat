import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    artifactType: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.artifactType && args.status) {
      return await ctx.db
        .query("artifacts")
        .withIndex("by_type_status", (q) =>
          q.eq("artifactType", args.artifactType!).eq("status", args.status!)
        )
        .order("desc")
        .collect();
    }

    let q = ctx.db.query("artifacts");

    if (args.artifactType) {
      q = q.withIndex("by_type_status", (idx) =>
        idx.eq("artifactType", args.artifactType!)
      );
    }

    const results = await q.order("desc").collect();

    if (args.status) {
      return results.filter((a) => a.status === args.status);
    }

    return results;
  },
});

export const listPublished = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("artifacts")
      .withIndex("by_type_status")
      .filter((q) => q.eq(q.field("status"), "published"))
      .order("desc")
      .take(50);
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("artifacts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const create = mutation({
  args: {
    artifactType: v.string(),
    title: v.string(),
    slug: v.string(),
    content: v.string(),
    contentFormat: v.string(),
    status: v.string(),
    metadata: v.optional(v.any()),
    qualityScores: v.optional(v.any()),
    llmProvider: v.optional(v.string()),
    llmModel: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("artifacts", args);
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("artifacts"),
    status: v.string(),
    publishedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args;
    await ctx.db.patch(id, patch);
  },
});

export const searchByContent = action({
  args: {
    query: v.string(),
    artifactType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const results = await ctx.runQuery(
      // Use the internal search query helper
      "artifacts:_searchByContent" as any,
      { query: args.query, artifactType: args.artifactType }
    );
    return results;
  },
});

// Internal query used by the searchByContent action
export const _searchByContent = query({
  args: {
    query: v.string(),
    artifactType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let searchQuery = ctx.db
      .query("artifacts")
      .withSearchIndex("search_content", (q) => {
        let sq = q.search("content", args.query);
        if (args.artifactType) {
          sq = sq.eq("artifactType", args.artifactType);
        }
        return sq;
      });

    return await searchQuery.take(20);
  },
});
