import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Operator Replay",
  description:
    "A transparent look at how GrowthRat makes decisions, from source ingestion to content delivery.",
};

const steps = [
  {
    phase: "Source Ingestion",
    icon: "📚",
    description:
      "GrowthRat ingests public RevenueCat docs, SDK repos, blog posts, community discussions, and real-time market intelligence.",
    detail:
      "Sources are classified by evidence tier (public product, market intelligence, community signal) and tracked for freshness. Durable workflows handle scheduled ingestion with automatic retry and deduplication.",
    sources: [
      "RevenueCat Docs",
      "RevenueCat GitHub",
      "Keyword Intelligence",
      "SERP Analysis",
      "Public Community Signals",
    ],
  },
  {
    phase: "Opportunity Discovery",
    icon: "🔍",
    description:
      "Multi-signal scoring identifies what to work on. Each opportunity is scored across key relevance and demand dimensions.",
    detail:
      "Opportunities are scored by keyword difficulty, search volume, and RevenueCat relevance. The scoring function is deterministic and produces a ranked list of content topics, experiment candidates, and feedback targets.",
    sources: [
      "Keyword Ideas",
      "SERP Snapshots",
      "AI Visibility Scores",
      "Content Trends",
      "Question Clusters",
    ],
  },
  {
    phase: "Lane Assignment",
    icon: "🛤️",
    description:
      "Each opportunity is assigned to a lane: flagship searchable, flagship shareable, canonical answer, experiment, product feedback, docs update, or derivative.",
    detail:
      "Weekly portfolio rules enforce minimum coverage: at least one searchable flagship, one shareable flagship, derivatives for each flagship, and one experiment linked to a flagship. The database stores lane state and portfolio progress.",
    sources: [],
  },
  {
    phase: "Content Generation",
    icon: "✍️",
    description:
      "The content pipeline generates articles using prompt templates grounded in the voice profile and retrieved evidence.",
    detail:
      "Each piece is generated with a system prompt enforcing GrowthRat's tone (technical, structured, evidence-backed, curious, direct) and recurring themes. The agent orchestrates multi-step generation with autonomous tool-calling and evidence retrieval.",
    sources: ["Content Pipeline", "Voice Profile", "Evidence Items"],
  },
  {
    phase: "Quality Gates",
    icon: "🚦",
    description:
      "Every artifact passes through a validation pipeline before shipping.",
    detail:
      "The validation pipeline checks grounding (claims are source-backed), voice consistency, and content length thresholds. Additional gates for novelty, technical accuracy, SEO, AEO, GEO, and benchmark are defined in the framework and will strengthen with real usage data.",
    sources: ["Publish Gate Framework", "Benchmark Corpus", "Voice Validator"],
  },
  {
    phase: "Distribution",
    icon: "🚀",
    description:
      "Published artifacts are distributed across channels with channel-specific derivatives.",
    detail:
      "Flagship pieces get social threads, code repository commits, and team notifications. Durable workflows handle fan-out distribution with per-channel rate limiting. Metrics are tracked for post-publish review.",
    sources: ["Social Platforms", "Code Repositories", "Team Communication", "Publishing Pipeline"],
  },
];

export default function OperatorReplayPage() {
  return (
    <div className="max-w-[var(--max-w-wide)] mx-auto px-6 py-16">
      {/* Header */}
      <header className="max-w-2xl mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 text-sm font-medium mb-4">
          Transparency
        </div>
        <h1 className="font-bold text-4xl md:text-5xl text-[var(--color-rc-dark)] leading-tight tracking-tight mb-4">
          How GrowthRat Works
        </h1>
        <p className="text-lg text-[var(--color-rc-muted)] leading-relaxed">
          A deterministic replay of GrowthRat&apos;s decision pipeline. No
          hidden prompts, no black boxes &mdash; every step is inspectable.
        </p>
      </header>

      {/* Pipeline visualization */}
      <div className="relative">
        {/* Vertical connector line */}
        <div className="absolute left-6 top-8 bottom-8 w-px bg-[var(--color-rc-border)] hidden md:block" />

        <div className="space-y-8">
          {steps.map((step, i) => (
            <div key={step.phase} className="relative md:pl-16">
              {/* Step number bubble */}
              <div className="hidden md:flex absolute left-0 top-0 w-12 h-12 rounded-full bg-white border-2 border-[var(--color-rc-border)] items-center justify-center text-lg font-bold text-[var(--color-rc-dark)] z-10">
                {i + 1}
              </div>

              <div className="p-6 rounded-xl border border-[var(--color-rc-border)] bg-white hover:shadow-[var(--shadow-card)] transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl md:hidden">{step.icon}</span>
                  <h3 className="font-bold text-xl text-[var(--color-rc-dark)]">
                    {step.phase}
                  </h3>
                </div>
                <p className="text-[var(--color-rc-text)] mb-3">
                  {step.description}
                </p>
                <p className="text-sm text-[var(--color-rc-muted)] mb-4">
                  {step.detail}
                </p>
                {step.sources.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {step.sources.map((source) => (
                      <span
                        key={source}
                        className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-rc-surface)] text-[var(--color-rc-muted)] font-medium border border-[var(--color-rc-border)]"
                      >
                        {source}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Architecture note */}
      <div className="mt-16 p-8 rounded-xl bg-[var(--color-rc-surface)] border border-[var(--color-rc-border)]">
        <h2 className="font-bold text-xl text-[var(--color-rc-dark)] mb-4">
          Architecture
        </h2>
        <div className="grid sm:grid-cols-3 gap-6 text-sm">
          <div>
            <h4 className="font-semibold text-[var(--color-rc-dark)] mb-1">
              Control Plane
            </h4>
            <p className="text-[var(--color-rc-muted)]">
              API routes and a reactive database. Exposes workflow triggers, status
              queries, and configuration endpoints with type-safe schemas.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-[var(--color-rc-dark)] mb-1">
              Orchestration
            </h4>
            <p className="text-[var(--color-rc-muted)]">
              Durable workflow engine for inspectable task execution with
              automatic retry, step functions, and audit trails.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-[var(--color-rc-dark)] mb-1">
              Connectors
            </h4>
            <p className="text-[var(--color-rc-muted)]">
              Slack, social platforms, code repositories, RevenueCat API, and keyword intelligence. Each handles auth,
              rate limiting, and graceful degradation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
