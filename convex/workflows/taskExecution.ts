/**
 * Task Execution Workflow — Stage 2 (Take-Home) readiness.
 *
 * Receives a novel task prompt, decomposes it into sub-tasks,
 * executes each using the content pipeline + tools, and packages
 * the deliverable.
 *
 * Entry: operator feeds the task via panel console or Slack
 * Output: completed artifacts stored in Convex, report posted to Slack
 */

import { workflow } from "./index";
import { internal } from "../_generated/api";
import { v } from "convex/values";

export const executeTask = workflow.define({
  args: {
    taskPrompt: v.string(),
    deadline: v.optional(v.string()), // e.g., "48 hours"
  },
  handler: async (step, { taskPrompt, deadline }): Promise<{
    taskPrompt: string;
    subtasks: number;
    artifactsCreated: number;
    reportGenerated: boolean;
  }> => {
    // Step 1: Decompose the task using LLM
    const plan = await step.runAction(
      internal.actions.decomposeTask,
      { taskPrompt, deadline: deadline ?? "48 hours" },
      { retry: true }
    );

    let artifactsCreated = 0;

    // Step 2: Execute content subtasks
    for (const contentTask of plan.contentTasks) {
      await step.runAction(
        internal.actions.generateContent,
        { topic: contentTask.topic, targetKeyword: contentTask.keyword },
        { retry: true }
      );
      artifactsCreated++;
    }

    // Step 3: Execute growth strategy subtask (if any)
    if (plan.growthStrategy) {
      await step.runAction(
        internal.actions.generateContent,
        {
          topic: plan.growthStrategy.topic,
          targetKeyword: plan.growthStrategy.keyword,
        },
        { retry: true }
      );
      artifactsCreated++;
    }

    // Step 4: Generate summary report
    await step.runAction(
      internal.actions.postToSlack,
      {
        text: `*🐭 Task Execution Complete*\n\nTask: ${taskPrompt}\nSubtasks: ${plan.contentTasks.length + (plan.growthStrategy ? 1 : 0)}\nArtifacts created: ${artifactsCreated}\n\nDeliverables are in the artifacts table.`,
      },
      { retry: true }
    );

    return {
      taskPrompt,
      subtasks: plan.contentTasks.length + (plan.growthStrategy ? 1 : 0),
      artifactsCreated,
      reportGenerated: true,
    };
  },
});
