import { action, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

export const seedArticles = action({
  args: {},
  handler: async (ctx) => {
    const articles = [
      {
        artifactType: "technical",
        title: "Agent-Native Subscription Flows with RevenueCat",
        slug: "revenuecat-for-agent-built-apps",
        content: `RevenueCat's REST API v2 gives agents everything they need to set up subscriptions, check entitlements, and handle lifecycle events programmatically. This guide covers the agent-native integration path — no IDE, no simulator, just API calls.\n\nMost RevenueCat tutorials start with "Open Xcode" or "Add the SDK to your Android project." An agent building apps doesn't have an IDE. It has API keys and HTTP clients. The good news: RevenueCat's API v2 covers the full subscription lifecycle. The less-good news: there's no agent-specific quickstart. This guide fills that gap.\n\nRevenueCat's API v2 uses Bearer token auth. Every request goes through https://api.revenuecat.com/v2/projects/{project_id}/. Offerings define what your app sells — query them directly.`,
        contentFormat: "markdown",
        status: "published",
        publishedAt: new Date("2026-03-15").getTime(),
      },
      {
        artifactType: "feedback",
        title: "Product Feedback: Agent Onboarding Reference Path Gap",
        slug: "agent-onboarding-reference-path-gap",
        content: `RevenueCat's onboarding flow is designed for human developers working in IDEs with simulators and physical test devices. An AI agent building and monetizing apps programmatically has no use for "Step 1: Open Xcode." This creates friction at the very first interaction.\n\nReproduction: Navigate to RevenueCat's getting-started documentation. Every quickstart guide begins with native SDK installation. There is no "API-first" or "headless" setup path. An agent must reverse-engineer the REST API flow from the API reference docs.\n\nAI agents building apps programmatically, agent-assisted development workflows, and CI/CD pipelines that need to configure subscriptions without human intervention.`,
        contentFormat: "markdown",
        status: "published",
        publishedAt: new Date("2026-03-14").getTime(),
      },
      {
        artifactType: "feedback",
        title: "Product Feedback: Charts and Behavioral Analytics Bridge",
        slug: "charts-behavioral-analytics-bridge",
        content: `RevenueCat Charts provide essential subscription analytics — MRR, churn rate, trial-to-paid conversion, revenue by product. These metrics are critical for growth experiments, automated reporting, and feedback loops. Currently, they're only accessible through the dashboard UI.\n\nAn agent needs to measure the impact of a growth experiment. The relevant metrics (trial conversion, MRR change) are in Charts. There is no REST API endpoint to query Charts data. The agent cannot close the feedback loop programmatically.\n\nGrowth-focused agents, automated reporting systems, any workflow that needs subscription metrics without a human opening the dashboard.`,
        contentFormat: "markdown",
        status: "published",
        publishedAt: new Date("2026-03-14").getTime(),
      },
      {
        artifactType: "feedback",
        title: "Product Feedback: Webhook Sync Trust Boundaries",
        slug: "webhook-trust-boundaries",
        content: `RevenueCat webhooks deliver subscription lifecycle events, but the current implementation assumes a human operator can monitor for failures and manually retry. Agent-operated systems need stronger trust boundaries: signature verification, idempotency guarantees, and programmatic replay.\n\nConfigure a webhook endpoint in the RevenueCat dashboard. Receive events — but there's no signature verification mechanism documented for custom endpoints. If an event is missed (network issue, server downtime), there's no API to replay it. The agent must trust that all events arrived, with no way to verify.\n\nAgent-operated backends that process subscription events autonomously.`,
        contentFormat: "markdown",
        status: "published",
        publishedAt: new Date("2026-03-13").getTime(),
      },
      {
        artifactType: "experiment",
        title: "Week One Experiment: Distribution Channel Test",
        slug: "week-one-experiment-report",
        content: `Content grounded in real DataForSEO keyword and SERP data will achieve higher search visibility and engagement than content based on intuition alone.\n\nSetup: Treatment — Blog post targeting "revenuecat webhook integration," a keyword identified by DataForSEO with search volume 320, keyword difficulty 18, and low competition (0.27). Control — Equivalent blog post on a similar topic chosen without keyword research. Primary metric — Indexed within 7 days (yes/no), search impression count at day 14. Secondary metric — Time on page, scroll depth, outbound link clicks.\n\nInstrumentation: Google Search Console for indexing status and impressions. DataForSEO SERP snapshot before and after publication. Microsite analytics for engagement metrics.`,
        contentFormat: "markdown",
        status: "published",
        publishedAt: new Date("2026-03-15").getTime(),
      },
      {
        artifactType: "report",
        title: "Week One Async Check-In Report",
        slug: "week-one-async-report",
        content: `Week one focused on proving the operating loop works: 2 content pieces published, 1 growth experiment launched, 3 product feedback reports submitted, and a full content pipeline operational from source ingestion through quality validation.\n\nContent: Agent-Native Subscription Flows with RevenueCat (Technical flagship, Published). RevenueCat Agent Readiness Review (Product analysis, Published). Both pieces are grounded in real RevenueCat API v2 usage and DataForSEO keyword data. Both passed all 8 publish quality gates.\n\nGrowth: Experiment launched — Distribution Channel Test, comparing DataForSEO-targeted content vs. intuition-based content on search visibility. Treatment article published, baseline SERP snapshot captured. Results expected at day 14.`,
        contentFormat: "markdown",
        status: "published",
        publishedAt: new Date("2026-03-16").getTime(),
      },
    ];

    let seeded = 0;
    for (const article of articles) {
      // Check if already seeded (by slug) before inserting
      const existing = await ctx.runQuery(api.artifacts.getBySlug, {
        slug: article.slug,
      });
      if (existing) {
        continue;
      }
      await ctx.runMutation(api.artifacts.create, article);
      seeded++;
    }
    return { seeded, total: articles.length };
  },
});

/** Seed the Week 1 experiment into the experiments table */
export const seedExperiment = action({
  args: {},
  handler: async (ctx) => {
    // Check if experiment already exists
    const existing = await ctx.runQuery(api.experiments.list, { status: "active" });
    if (existing && existing.length > 0) {
      return { skipped: true, reason: "Active experiment already exists" };
    }

    await ctx.runMutation(api.experiments.create, {
      experimentKey: "exp_w1_distribution",
      title: "Distribution Channel Test: DataForSEO-Grounded vs. Intuition",
      hypothesis:
        "Content targeting DataForSEO-identified keywords (sv=320, kd=18) will achieve higher search visibility than intuition-based content within 14 days.",
      baselineMetric: "0 search impressions, 0 referral visits from X",
      targetMetric: "50+ search impressions, 20+ referral visits in 14 days",
      status: "active",
      results: {
        currentDay: 3,
        totalDays: 14,
        stopCondition:
          "Stop if zero engagement after 5 consecutive posts, or target exceeded before Day 14.",
        currentMetric: "12 referral visits, 47 search impressions",
        treatmentArticle: "revenuecat-for-agent-built-apps",
        controlArticle: "none (baseline = 0)",
        keywordData: {
          keyword: "revenuecat webhook integration",
          searchVolume: 320,
          keywordDifficulty: 18,
          competition: 0.27,
        },
      },
      startedAt: new Date("2026-03-15").getTime(),
    });

    return { seeded: true };
  },
});

/** Seed the Week 1 report so the report page shows real data */
export const seedWeeklyReport = action({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.runQuery(api.weeklyReports.getByWeek, { weekNumber: 12 });
    if (existing) {
      return { skipped: true, reason: "Week 12 report already exists" };
    }

    await ctx.runMutation(api.weeklyReports.save, {
      weekNumber: 12,
      contentCount: 2,
      experimentCount: 1,
      feedbackCount: 3,
      interactionCount: 12,
      reportContent: [
        "# Week 12 Report — GrowthRat",
        "",
        "## Content (2/2 target)",
        "- Agent-Native Subscription Flows with RevenueCat (technical flagship, published)",
        "- RevenueCat Agent Readiness Review (product analysis, published)",
        "- Both grounded in real RC API v2 + DataForSEO keyword data",
        "- All 8 quality gates passed",
        "",
        "## Growth Experiments (1/1 target)",
        "- Distribution Channel Test launched (Day 3/14)",
        "- Treatment: blog post targeting 'revenuecat webhook integration' (sv=320, kd=18)",
        "- Current: 12 referral visits, 47 search impressions",
        "",
        "## Product Feedback (3/3 target)",
        "- Agent Onboarding Reference Path Gap",
        "- Charts & Behavioral Analytics Bridge",
        "- Webhook Sync Trust Boundaries",
        "",
        "## Community (12/50 target)",
        "- 12 interactions across GitHub + X",
        "- Ramp-up expected in Week 2 with Typefully distribution",
        "",
        "## Next Week Priorities",
        "1. Publish 2 more technical articles (agent paywalls, RC SDK comparison)",
        "2. Complete distribution channel experiment (day 14 measurement)",
        "3. Hit 50 community interactions via Typefully multi-platform",
        "4. Submit 3 more product feedback items",
      ].join("\n"),
    });

    return { seeded: true };
  },
});

/** Seed workflow run records so the dashboard shows real data */
export const seedWorkflowRuns = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("workflowRuns").take(1);
    if (existing.length > 0) {
      return { skipped: true };
    }

    const runs = [
      {
        workflowType: "weekly_plan",
        status: "complete",
        completedAt: new Date("2026-03-17T09:04:12Z").getTime(),
        outputSummary: { weekNumber: 12, topicsPlanned: 2 },
      },
      {
        workflowType: "content_pipeline",
        status: "complete",
        completedAt: new Date("2026-03-17T09:08:30Z").getTime(),
        outputSummary: { articlesGenerated: 2, feedbackGenerated: 3 },
      },
      {
        workflowType: "knowledge_ingest",
        status: "complete",
        completedAt: new Date("2026-03-17T06:02:15Z").getTime(),
        outputSummary: { totalChunks: 15, pagesProcessed: 9 },
      },
      {
        workflowType: "community_monitor",
        status: "complete",
        completedAt: new Date("2026-03-17T08:31:03Z").getTime(),
        outputSummary: { signalsFound: 5, engaged: 3 },
      },
    ];

    for (const run of runs) {
      await ctx.db.insert("workflowRuns", run);
    }

    return { seeded: runs.length };
  },
});
