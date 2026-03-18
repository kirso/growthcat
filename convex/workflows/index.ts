/**
 * GrowthRat Workflows — Convex Workflow definitions replacing Inngest.
 *
 * Why Convex Workflow instead of Inngest:
 * - Direct DB access: step.runMutation/runQuery/runAction — no HTTP bridge
 * - No shared secret needed: everything runs inside Convex
 * - Durable: steps persist, retry on failure, resume after restart
 * - Native: same platform as the database, agent, and crons
 */

import { WorkflowManager } from "@convex-dev/workflow";
import { components, internal } from "../_generated/api";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

export const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    maxParallelism: 10,
    retryActionsByDefault: true,
    defaultRetryBehavior: {
      maxAttempts: 3,
      initialBackoffMs: 1000,
      base: 2,
    },
  },
});

/**
 * Weekly Planning Workflow
 * Triggered by Convex cron (Monday 9am UTC)
 * Discovers keywords → scores → plans → triggers content generation
 */
export const weeklyPlanWorkflow = workflow.define({
  args: { weekNumber: v.number() },
  handler: async (step, { weekNumber }): Promise<{ weekNumber: number; topicsPlanned: number }> => {
    // Step 1: Fetch keyword data from DataForSEO
    const keywords = await step.runAction(
      internal.actions.fetchKeywords,
      { seeds: ["revenuecat webhook", "revenuecat api", "mobile app monetization"] },
      { retry: true }
    );

    // Step 2: Score and select opportunities
    const plan = await step.runMutation(
      internal.mutations.scorePlan,
      { keywords, weekNumber }
    );

    // Step 3: Post plan to Slack
    await step.runAction(
      internal.actions.postToSlack,
      { text: `*🐭 Weekly Plan — Week ${weekNumber}*\n\nTopics: ${plan.contentTopics.join(", ")}` },
      { retry: true }
    );

    // Step 4: Trigger content generation for each topic
    for (const topic of plan.contentTopics) {
      await step.runAction(
        internal.actions.startContentWorkflow,
        { topic, targetKeyword: topic, weekNumber }
      );
    }

    // Step 5: Trigger feedback generation
    await step.runAction(
      internal.actions.startFeedbackWorkflow,
      { topics: plan.feedbackTopics }
    );

    // Step 6: Start experiment for the third-ranked keyword
    if (plan.experimentTopic) {
      await step.runAction(
        internal.actions.startExperimentWorkflow,
        {
          experimentKey: `exp-w${weekNumber}-${plan.experimentTopic.replace(/\s+/g, "-").slice(0, 30)}`,
          hypothesis: `Publishing targeted content for "${plan.experimentTopic}" will achieve search indexing within 14 days`,
          targetKeyword: plan.experimentTopic,
          contentSlug: plan.experimentTopic.replace(/\s+/g, "-"),
        }
      );
    }

    return { weekNumber, topicsPlanned: plan.contentTopics.length };
  },
});

/**
 * Content Generation Workflow
 * Generates content → validates → publishes → distributes
 */
export const contentGenWorkflow = workflow.define({
  args: {
    topic: v.string(),
    targetKeyword: v.string(),
  },
  handler: async (step, { topic, targetKeyword }): Promise<{ artifactId: string; published: boolean }> => {
    // Step 1: Generate content via LLM
    const draft = await step.runAction(
      internal.actions.generateContent,
      { topic, targetKeyword },
      { retry: true }
    );

    const artifactId = draft.artifactId as Id<"artifacts">;

    // Step 2: Run quality gates
    const validation = await step.runAction(
      internal.actions.validateQuality,
      { content: draft.content, artifactId }
    );

    // Step 3: If validated, post for Slack approval then publish
    if (validation.allPassed) {
      await step.runMutation(
        internal.mutations.updateArtifactStatus,
        { id: artifactId, status: "validated" }
      );

      // Post to Slack for approval (auto-approves if no Slack token)
      const approval = await step.runAction(
        internal.slackApproval.postForApproval,
        {
          artifactId,
          title: topic,
          slug: targetKeyword.replace(/\s+/g, "-"),
          contentPreview: draft.content.slice(0, 500),
          qualityGates: validation.gates.map((g: { key: string; passed: boolean }) => g.passed ? `${g.key}` : `~${g.key}~`).join(", "),
        },
        { retry: true }
      );

      // If auto-approved (no Slack) or we don't wait for reaction, proceed to publish
      // In production with Slack, the reaction handler triggers publishing separately
      // For now: publish immediately after posting for approval
      if (approval.autoApproved || approval.posted) {
        // Publish to CMS
        await step.runAction(
          internal.actions.publishToCMS,
          { artifactId },
          { retry: true }
        );

        // Distribute via Typefully
        await step.runAction(
          internal.actions.distributeViaTypefully,
          { artifactId, topic },
          { retry: true }
        );

        // Distribute via GitHub
        await step.runAction(
          internal.actions.distributeViaGitHub,
          { artifactId: draft.artifactId as Id<"artifacts">, title: topic, slug: targetKeyword.replace(/\s+/g, "-"), content: draft.content },
          { retry: true }
        );

        await step.runMutation(
          internal.mutations.updateArtifactStatus,
          { id: artifactId, status: "published" }
        );
      }
    } else {
      await step.runMutation(
        internal.mutations.updateArtifactStatus,
        { id: artifactId, status: "rejected" }
      );
    }

    return { artifactId: draft.artifactId, published: validation.allPassed };
  },
});

/**
 * Weekly Report Workflow
 * Triggered by Convex cron (Friday 5pm UTC)
 */
export const weeklyReportWorkflow = workflow.define({
  args: { weekNumber: v.number() },
  handler: async (step, { weekNumber }): Promise<{ weekNumber: number; metrics: Record<string, number> }> => {
    // Step 1: Gather real metrics directly from DB
    const metrics = await step.runQuery(
      internal.mutations.gatherWeeklyMetrics,
      {}
    );

    // Step 2: Generate report via LLM
    const report = await step.runAction(
      internal.actions.generateReport,
      { weekNumber, metrics },
      { retry: true }
    );

    // Step 3: Post to Slack
    await step.runAction(
      internal.actions.postToSlack,
      { text: `*🐭 Weekly Report — Week ${weekNumber}*\n\n${report.content.slice(0, 3000)}` },
      { retry: true }
    );

    // Step 4: Store report
    await step.runMutation(
      internal.mutations.saveWeeklyReport,
      { weekNumber, metrics, content: report.content }
    );

    return { weekNumber, metrics };
  },
});

/**
 * Knowledge Ingestion Workflow
 * Crawls RC docs → chunks → embeds → stores
 */
export const knowledgeIngestWorkflow = workflow.define({
  args: {},
  handler: async (step): Promise<{ totalChunks?: number; signalsFound?: number; engaged?: number }> => {
    const result = await step.runAction(
      internal.actions.ingestKnowledge,
      {},
      { retry: true }
    );

    return result;
  },
});

/**
 * Community Monitor Workflow
 * Scans RC GitHub repos for agent-related issues
 */
export const communityMonitorWorkflow = workflow.define({
  args: {},
  handler: async (step): Promise<{ totalChunks?: number; signalsFound?: number; engaged?: number }> => {
    // Scan GitHub repos
    const signals = await step.runAction(
      internal.actions.scanGitHubRepos,
      {},
      { retry: true }
    );

    // Generate and post responses for relevant issues
    for (const signal of signals.slice(0, 5)) {
      await step.runAction(
        internal.actions.engageCommunity,
        { channel: signal.channel, context: signal.context, targetUrl: signal.url },
        { retry: true }
      );
    }

    return { signalsFound: signals.length, engaged: Math.min(signals.length, 5) };
  },
});
