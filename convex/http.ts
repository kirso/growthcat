import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// ---------------------------------------------------------------------------
// Auth helper — all mutating endpoints require a bearer token.
// The token is GROWTHCAT_INTERNAL_SECRET, shared between Inngest and Convex.
// This prevents anyone with the Convex URL from writing arbitrary data.
// ---------------------------------------------------------------------------
function verifyInternalAuth(request: Request): boolean {
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const expected = process.env.GROWTHCAT_INTERNAL_SECRET;

  // If no secret is configured, reject all requests (fail closed)
  if (!expected) return false;

  return token === expected;
}

function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// POST endpoints — called by Inngest functions to persist results in Convex
// All require Bearer token authentication.
// ---------------------------------------------------------------------------

http.route({
  path: "/api/artifacts",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyInternalAuth(request)) return unauthorizedResponse();
    const body = await request.json();
    const id = await ctx.runMutation(api.artifacts.create, body);
    return new Response(JSON.stringify({ id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/api/feedback",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyInternalAuth(request)) return unauthorizedResponse();
    const body = await request.json();
    const id = await ctx.runMutation(api.feedbackItems.create, body);
    return new Response(JSON.stringify({ id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/api/community",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyInternalAuth(request)) return unauthorizedResponse();
    const body = await request.json();
    const id = await ctx.runMutation(api.community.record, body);
    return new Response(JSON.stringify({ id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/api/reports",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyInternalAuth(request)) return unauthorizedResponse();
    const body = await request.json();
    const id = await ctx.runMutation(api.weeklyReports.save, body);
    return new Response(JSON.stringify({ id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/api/opportunities",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyInternalAuth(request)) return unauthorizedResponse();
    const body = await request.json();
    const id = await ctx.runMutation(api.opportunities.create, body);
    return new Response(JSON.stringify({ id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/api/workflow-runs",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyInternalAuth(request)) return unauthorizedResponse();
    const body = await request.json();
    const id = await ctx.runMutation(api.workflowRuns.create, body);
    return new Response(JSON.stringify({ id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// Store a source chunk with embedding (knowledge ingestion)
http.route({
  path: "/api/sources",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyInternalAuth(request)) return unauthorizedResponse();
    const body = await request.json();
    const id = await ctx.runMutation(api.sources.upsertWithEmbedding, body);
    return new Response(JSON.stringify({ id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// ---------------------------------------------------------------------------
// GET endpoints — read-only, still require auth to prevent data leaks
// ---------------------------------------------------------------------------

http.route({
  path: "/api/metrics",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!verifyInternalAuth(request)) return unauthorizedResponse();
    const [artifacts, experiments, feedback, community, latestReport] =
      await Promise.all([
        ctx.runQuery(api.artifacts.list, { status: "published" }),
        ctx.runQuery(api.experiments.list, { status: "running" }),
        ctx.runQuery(api.feedbackItems.list, {}),
        ctx.runQuery(api.community.getStats),
        ctx.runQuery(api.weeklyReports.getLatest),
      ]);

    return new Response(
      JSON.stringify({
        contentCount: artifacts?.length ?? 0,
        experimentCount: experiments?.length ?? 0,
        feedbackCount: feedback?.length ?? 0,
        interactionCount: community?.total ?? 0,
        meaningfulCount: community?.meaningful ?? 0,
        lastReportWeek: latestReport?.weekNumber ?? 0,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }),
});

export default http;
