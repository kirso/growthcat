import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  artifacts: defineTable({
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
  })
    .index("by_type_status", ["artifactType", "status"])
    .index("by_slug", ["slug"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["artifactType"],
    }),

  workflowRuns: defineTable({
    workflowType: v.string(),
    status: v.string(),
    inputParams: v.optional(v.any()),
    outputSummary: v.optional(v.any()),
    completedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  }).index("by_type_status", ["workflowType", "status"]),

  experiments: defineTable({
    experimentKey: v.string(),
    title: v.string(),
    hypothesis: v.string(),
    baselineMetric: v.string(),
    targetMetric: v.string(),
    status: v.string(),
    results: v.optional(v.any()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  }).index("by_status", ["status"]),

  feedbackItems: defineTable({
    title: v.string(),
    problem: v.string(),
    evidence: v.optional(v.string()),
    proposedFix: v.optional(v.string()),
    sourceLane: v.optional(v.string()),
    status: v.string(),
    metadata: v.optional(v.any()),
  }).index("by_status", ["status"]),

  opportunitySnapshots: defineTable({
    slug: v.string(),
    title: v.string(),
    lane: v.string(),
    audience: v.optional(v.string()),
    score: v.number(),
    components: v.optional(v.any()),
    rationale: v.optional(v.string()),
    readinessScore: v.optional(v.number()),
    readinessPasses: v.boolean(),
    workflowRunId: v.optional(v.id("workflowRuns")),
  }).index("by_lane_score", ["lane", "score"]),

  communityInteractions: defineTable({
    channel: v.string(),
    interactionType: v.string(),
    content: v.string(),
    targetUrl: v.optional(v.string()),
    qualityScore: v.optional(v.number()),
    meaningful: v.boolean(),
  })
    .index("by_channel", ["channel"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["channel"],
    }),

  weeklyReports: defineTable({
    weekNumber: v.number(),
    contentCount: v.number(),
    experimentCount: v.number(),
    feedbackCount: v.number(),
    interactionCount: v.number(),
    reportContent: v.string(),
    slackTs: v.optional(v.string()),
  }).index("by_week", ["weekNumber"]),

  sources: defineTable({
    key: v.string(),
    url: v.optional(v.string()),
    provider: v.string(),
    sourceClass: v.string(),
    evidenceTier: v.string(),
    lastRefreshed: v.number(),
    contentHash: v.string(),
    summary: v.optional(v.string()),
    // VS-A1: embedding for vector search (RAG over custom knowledge)
    embedding: v.optional(v.array(v.float64())),
    // VS-A1: chunk metadata
    chunkIndex: v.optional(v.number()),
    parentKey: v.optional(v.string()),
  })
    .index("by_provider", ["provider"])
    .index("by_key", ["key"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["provider", "evidenceTier"],
    }),

  // VS-B5: Non-secret agent configuration (set during onboarding)
  agentConfig: defineTable({
    reviewMode: v.string(), // "draft_only" | "semi_auto" | "bounded_autonomy"
    focusTopics: v.array(v.string()),
    slackChannel: v.string(),
    githubOrg: v.optional(v.string()),
    enabledPlatforms: v.array(v.string()),
    paused: v.boolean(),
  }),

  // VS-B1: Approval tracking
  approvalLog: defineTable({
    artifactId: v.id("artifacts"),
    action: v.string(), // "approved" | "rejected" | "override"
    by: v.string(), // "slack_reaction" | "quality_gates_auto" | "operator"
    reason: v.optional(v.string()),
    slackThreadTs: v.optional(v.string()),
  }).index("by_artifact", ["artifactId"]),
});
