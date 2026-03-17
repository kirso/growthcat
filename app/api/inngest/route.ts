import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import {
  weeklyPlanningRun,
  generateContent,
  sourceFreshnessAudit,
  weeklyReportGeneration,
  generateFeedback,
  communityEngage,
} from "@/inngest/functions";
import { communityMonitor } from "@/inngest/community-monitor";
import { handleSlackCommand } from "@/inngest/slack-handler";
import {
  ingestKnowledge,
  dailyKnowledgeRefresh,
} from "@/inngest/ingest-knowledge";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // VS-A1: Knowledge ingestion
    ingestKnowledge,
    dailyKnowledgeRefresh,
    // Weekly cycle
    weeklyPlanningRun,
    generateContent,
    sourceFreshnessAudit,
    weeklyReportGeneration,
    generateFeedback,
    communityEngage,
    // Community + Slack
    communityMonitor,
    handleSlackCommand,
  ],
});
