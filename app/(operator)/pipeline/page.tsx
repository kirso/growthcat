"use client";

import { useConvexQuery, convexApi } from "../hooks/useConvexSafe";

// Sample data — used as fallback when Convex isn't connected
interface ContentSlot {
  id: string;
  title: string;
  stage: "Draft" | "Quality Gates" | "Published";
  gates: boolean[]; // true = passed
}

interface Opportunity {
  score: number;
  title: string;
  lane: "SEO" | "Social" | "Community" | "Technical";
}

const SAMPLE_SLOTS: ContentSlot[] = [
  {
    id: "flagship_1",
    title: "Why RevenueCat Should Hire an AI Growth Agent",
    stage: "Quality Gates",
    gates: [true, true, true, true, true, false, false, true],
  },
  {
    id: "flagship_2",
    title: "Building Developer Advocacy with Agentic AI",
    stage: "Draft",
    gates: [true, true, false, false, false, false, false, false],
  },
];

const SAMPLE_DERIVATIVES = [
  { type: "X Thread", title: "Thread: AI-first developer advocacy", status: "queued" },
  { type: "X Thread", title: "Thread: Why agentic hiring matters", status: "queued" },
  { type: "Gist", title: "GrowthCat architecture overview", status: "queued" },
];

const SAMPLE_OPPORTUNITIES: Opportunity[] = [
  { score: 92, title: "RevenueCat SDK integration deep-dive", lane: "Technical" },
  { score: 87, title: "Developer community engagement playbook", lane: "Community" },
  { score: 81, title: "Agentic AI for growth — SEO long-tail", lane: "SEO" },
  { score: 74, title: "X/Twitter growth for dev tools", lane: "Social" },
];

const stageBadgeColors = {
  Draft: "bg-[var(--color-op-amber)]/15 text-[var(--color-op-amber)]",
  "Quality Gates": "bg-[var(--color-op-blue)]/15 text-[var(--color-op-blue)]",
  Published: "bg-[var(--color-op-green)]/15 text-[var(--color-op-green)]",
};

const laneBadgeColors: Record<Opportunity["lane"], string> = {
  SEO: "bg-purple-500/15 text-purple-400",
  Social: "bg-[var(--color-op-blue)]/15 text-[var(--color-op-blue)]",
  Community: "bg-[var(--color-op-green)]/15 text-[var(--color-op-green)]",
  Technical: "bg-[var(--color-op-amber)]/15 text-[var(--color-op-amber)]",
};

function GateProgress({ gates }: { gates: boolean[] }) {
  return (
    <div className="flex items-center gap-1">
      {gates.map((passed, i) => (
        <span
          key={i}
          className={`inline-block w-3 h-3 rounded-full text-[10px] flex items-center justify-center ${
            passed
              ? "bg-[var(--color-op-green)]"
              : "bg-[var(--color-op-card-alt)] border border-[var(--color-op-border)]"
          }`}
        />
      ))}
      <span className="ml-2 text-xs text-[var(--color-op-dim)]">
        {gates.filter(Boolean).length}/{gates.length}
      </span>
    </div>
  );
}

export default function PipelinePage() {
  // CONVEX: wire to api.artifacts.list when connected (flagship content)
  const convexArtifacts = useConvexQuery(convexApi?.artifacts?.list, {
    artifactType: "flagship",
  });

  // CONVEX: wire to api.opportunities.getTopOverall when connected
  const convexOpportunities = useConvexQuery(
    convexApi?.opportunities?.getTopOverall,
    { limit: 10 }
  );

  // Map Convex artifacts to the UI shape, or fall back to sample data.
  // Use sample data as the default immediately so there is no flash of
  // empty state while the Convex hook resolves (it returns undefined
  // during SSR and on first client render when Convex is not connected).
  const slots: ContentSlot[] = convexArtifacts && convexArtifacts.length > 0
    ? convexArtifacts.map((a: any) => ({
        id: a.slug ?? a._id,
        title: a.title,
        stage: a.status === "published"
          ? "Published" as const
          : a.status === "review"
            ? "Quality Gates" as const
            : "Draft" as const,
        gates: a.qualityScores
          ? Object.values(a.qualityScores).map((v: any) => Boolean(v))
          : [false, false, false, false, false, false, false, false],
      }))
    : SAMPLE_SLOTS;

  // Map Convex opportunities to the UI shape, or fall back to sample data.
  // Same pattern: sample data is the default so the layout never flashes.
  const opportunities: Opportunity[] = convexOpportunities && convexOpportunities.length > 0
    ? convexOpportunities.map((o: any) => ({
        score: o.score,
        title: o.title,
        lane: (o.lane ?? "Technical") as Opportunity["lane"],
      }))
    : SAMPLE_OPPORTUNITIES;

  const derivatives = SAMPLE_DERIVATIVES; // No dedicated derivatives table yet

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-xl font-semibold text-[var(--color-op-text)]">
        Content Pipeline
      </h1>

      {/* This Week's Plan */}
      <section>
        <h2 className="text-sm font-medium text-[var(--color-op-muted)] uppercase tracking-wider mb-3">
          This Week&apos;s Plan
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {slots.map((slot, index) => (
            <div
              key={slot.id}
              className="rounded-lg bg-[var(--color-op-card)] border border-[var(--color-op-border)] p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="text-xs text-[var(--color-op-dim)] mb-1">
                    Flagship {index + 1}
                  </div>
                  <h3 className="text-sm font-medium text-[var(--color-op-text)] leading-snug">
                    {slot.title}
                  </h3>
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${stageBadgeColors[slot.stage]}`}
                >
                  {slot.stage}
                </span>
              </div>
              <div className="text-xs text-[var(--color-op-dim)] mb-1.5">
                Quality Gates
              </div>
              <GateProgress gates={slot.gates} />
            </div>
          ))}
        </div>
      </section>

      {/* Derivatives */}
      <section>
        <h2 className="text-sm font-medium text-[var(--color-op-muted)] uppercase tracking-wider mb-3">
          Derivatives
        </h2>
        <div className="rounded-lg bg-[var(--color-op-card)] border border-[var(--color-op-border)] divide-y divide-[var(--color-op-border)]">
          {derivatives.map((d, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-op-card-alt)] text-[var(--color-op-muted)]">
                  {d.type}
                </span>
                <span className="text-sm text-[var(--color-op-text)]">
                  {d.title}
                </span>
              </div>
              <span className="text-xs text-[var(--color-op-dim)]">
                {d.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Opportunity Queue */}
      <section>
        <h2 className="text-sm font-medium text-[var(--color-op-muted)] uppercase tracking-wider mb-3">
          Opportunity Queue
        </h2>
        <div className="rounded-lg bg-[var(--color-op-card)] border border-[var(--color-op-border)] divide-y divide-[var(--color-op-border)]">
          {opportunities.map((opp, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <span className="shrink-0 w-10 text-right font-mono text-sm font-semibold text-[var(--color-op-green)]">
                {opp.score}
              </span>
              <span className="flex-1 text-sm text-[var(--color-op-text)]">
                {opp.title}
              </span>
              <span
                className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${laneBadgeColors[opp.lane]}`}
              >
                {opp.lane}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
