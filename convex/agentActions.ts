/**
 * Convex Agent Actions
 *
 * These actions power the chat widget and panel console.
 * They use the GrowthCat Convex Agent for thread management,
 * message persistence, RAG, and tool calling.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { growthCatAgent } from "./agent";

/**
 * Start a new conversation thread.
 * Called when a user opens the chat widget for the first time.
 */
export const createThread = action({
  args: {
    prompt: v.string(),
  },
  handler: async (ctx, { prompt }) => {
    const { threadId, thread } = await growthCatAgent.createThread(ctx);
    const result = await thread.generateText({ prompt });
    return {
      threadId,
      text: result.text,
    };
  },
});

/**
 * Continue an existing conversation thread.
 * Called for follow-up messages in an existing chat session.
 * Automatically includes previous message history.
 */
export const continueThread = action({
  args: {
    threadId: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, { threadId, prompt }) => {
    const { thread } = await growthCatAgent.continueThread(ctx, { threadId });
    const result = await thread.generateText({ prompt });
    return {
      threadId,
      text: result.text,
    };
  },
});

/**
 * Stream a response (for the chat widget / panel console).
 * Uses the same agent brain but returns a streaming response.
 */
export const streamChat = action({
  args: {
    threadId: v.optional(v.string()),
    prompt: v.string(),
  },
  handler: async (ctx, { threadId, prompt }) => {
    if (threadId) {
      const { thread } = await growthCatAgent.continueThread(ctx, { threadId });
      const result = await thread.generateText({ prompt });
      return { threadId, text: result.text };
    }

    const { threadId: newThreadId, thread } =
      await growthCatAgent.createThread(ctx);
    const result = await thread.generateText({ prompt });
    return { threadId: newThreadId, text: result.text };
  },
});
