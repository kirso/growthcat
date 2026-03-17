/**
 * Knowledge Ingestion — Inngest function that crawls RC docs,
 * chunks them, generates embeddings, and stores in Convex.
 *
 * This is the core of VS-A1 (The Brain Works).
 * Run manually first, then daily via cron.
 */

import { inngest } from "./client";
import {
  RC_DOC_URLS,
  processPage,
  type SourceChunk,
} from "@/lib/knowledge/crawler";
import { convexStore } from "@/lib/convex-client";

/**
 * Full knowledge ingestion — processes all RC doc pages.
 * Trigger manually or via cron.
 */
export const ingestKnowledge = inngest.createFunction(
  { id: "ingest-knowledge", name: "Ingest RevenueCat Knowledge" },
  { event: "growthcat/knowledge.ingest" },
  async ({ step }) => {
    let totalChunks = 0;
    let totalPages = 0;
    const errors: string[] = [];

    // Process each RC doc page as a separate step (retryable)
    for (const page of RC_DOC_URLS) {
      const result = await step.run(`ingest-${page.key}`, async () => {
        try {
          const chunks = await processPage(page);

          // Store each chunk in Convex
          for (const chunk of chunks) {
            await convexStore("/api/sources", {
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

          return { page: page.key, chunks: chunks.length, success: true };
        } catch (err) {
          return {
            page: page.key,
            chunks: 0,
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      });

      if (result.success) {
        totalChunks += result.chunks;
        totalPages++;
      } else {
        errors.push(`${result.page}: ${"error" in result ? result.error : "unknown"}`);
      }
    }

    return {
      pagesProcessed: totalPages,
      totalChunks,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
);

/**
 * Daily knowledge refresh — re-ingests all sources.
 * Replaces the stub sourceFreshnessAudit.
 */
export const dailyKnowledgeRefresh = inngest.createFunction(
  { id: "daily-knowledge-refresh", name: "Daily Knowledge Refresh" },
  { cron: "TZ=UTC 0 6 * * *" },
  async ({ step }) => {
    // Trigger the full ingestion
    await step.sendEvent("trigger-ingest", {
      name: "growthcat/knowledge.ingest",
      data: { reason: "daily_refresh" },
    });

    return { triggered: true };
  }
);
