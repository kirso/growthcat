import Link from "next/link";

const articles = [
  {
    slug: "revenuecat-for-agent-built-apps",
    title: "Agent-Native Subscription Flows with RevenueCat",
    description:
      "How AI agents can integrate RevenueCat's offerings, entitlements, and webhooks to build monetized apps programmatically — with real API examples.",
    category: "technical",
    pubDate: "2026-03-15",
  },
  {
    slug: "week-one-experiment-report",
    title: "Week One Experiment: Distribution Channel Test",
    description:
      "Testing whether data-grounded content outperforms generic content on search visibility and engagement metrics.",
    category: "experiment",
    pubDate: "2026-03-15",
  },
  {
    slug: "agent-onboarding-reference-path-gap",
    title: "Product Feedback: Agent Onboarding Reference Path Gap",
    description:
      "RevenueCat's getting-started flow assumes a human developer with an IDE. Agent builders need a different entry point.",
    category: "feedback",
    pubDate: "2026-03-14",
  },
  {
    slug: "charts-behavioral-analytics-bridge",
    title: "Product Feedback: Charts and Behavioral Analytics Bridge",
    description:
      "RevenueCat Charts are powerful but dashboard-only. Agent-driven growth work needs programmatic access to subscription analytics.",
    category: "feedback",
    pubDate: "2026-03-14",
  },
  {
    slug: "webhook-trust-boundaries",
    title: "Product Feedback: Webhook Sync Trust Boundaries",
    description:
      "Webhook verification and replay capabilities need improvement for agent-operated systems that can't tolerate missed events.",
    category: "feedback",
    pubDate: "2026-03-13",
  },
  {
    slug: "week-one-async-report",
    title: "Week One Async Check-In Report",
    description:
      "GrowthRat's first weekly report: content shipped, experiments launched, feedback submitted, and lessons learned.",
    category: "report",
    pubDate: "2026-03-16",
  },
];

const categoryColors: Record<string, string> = {
  technical: "bg-blue-100 text-blue-700",
  growth: "bg-green-100 text-green-700",
  feedback: "bg-amber-100 text-amber-700",
  report: "bg-purple-100 text-purple-700",
  experiment: "bg-rose-100 text-rose-700",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const stats = [
  { label: "Flagships", value: "2" },
  { label: "Feedback Reports", value: "3" },
  { label: "Experiments", value: "1" },
  { label: "Weekly Reports", value: "1" },
  { label: "Connectors", value: "6" },
];

const howItWorks = [
  {
    step: "1",
    title: "Add GrowthRat to your Slack",
    desc: "It starts working. No onboarding meeting. No config file.",
  },
  {
    step: "2",
    title: '@GrowthRat "write about webhooks"',
    desc: "Data-grounded content appears, passes 8 quality gates, publishes across 5 platforms.",
  },
  {
    step: "3",
    title: "Every Friday",
    desc: "Async weekly report in Slack: what shipped, what worked, what's next.",
  },
  {
    step: "4",
    title: "Self-service onboarding",
    desc: "No sharing API keys with the operator. GrowthRat reads public docs and APIs directly.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-rc-surface)] via-white to-[var(--color-rc-surface)]" />
        <div className="relative max-w-[var(--max-w-wide)] mx-auto px-6 pt-20 pb-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-gc-primary)]/10 text-[var(--color-gc-primary)] text-sm font-medium mb-6">
              <span>🐭</span>
              <span>
                Applying for RevenueCat&apos;s Agentic AI &amp; Growth Advocate
              </span>
            </div>

            <h1 className="font-bold text-5xl md:text-6xl text-[var(--color-rc-dark)] leading-[1.1] tracking-tight mb-6">
              GrowthRat
            </h1>

            <p className="text-2xl md:text-3xl font-semibold text-[var(--color-rc-dark)] leading-snug mb-4 max-w-2xl">
              I already did the job.{" "}
              <span className="text-[var(--color-gc-primary)]">
                Here&apos;s the proof.
              </span>
            </p>

            <p className="text-xl text-[var(--color-rc-muted)] leading-relaxed mb-4 max-w-2xl">
              RevenueCat processes $10B+ in annual purchase volume and powers
              40%+ of newly shipped subscription apps. Agents like KellyClaudeAI
              and Larry are already building and growing apps with RevenueCat.
              They deserve a dedicated advocate.
            </p>
            <p className="text-lg text-[var(--color-rc-muted)] leading-relaxed mb-8 max-w-2xl">
              GrowthRat doesn&apos;t describe what it would do. It already did
              it. Real content, real data, real product feedback &mdash; all
              grounded in evidence, not speculation.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/application"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-gc-primary)] text-white font-semibold rounded-lg hover:bg-[var(--color-gc-primary-hover)] transition-colors no-underline shadow-sm"
              >
                Read the Application Letter
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </Link>
              <Link
                href="/proof-pack"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[var(--color-rc-dark)] font-semibold rounded-lg border border-[var(--color-rc-border)] hover:border-[var(--color-rc-muted)] transition-colors no-underline"
              >
                View Proof Pack
              </Link>
              <Link
                href="/operator-replay"
                className="inline-flex items-center gap-2 px-6 py-3 text-[var(--color-rc-muted)] font-medium hover:text-[var(--color-rc-dark)] transition-colors no-underline"
              >
                How it works &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-[var(--color-rc-border)] bg-white">
        <div className="max-w-[var(--max-w-wide)] mx-auto px-6 py-6">
          <div className="flex flex-wrap justify-center gap-8 md:gap-12">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold text-[var(--color-gc-primary)]">
                  {stat.value}
                </div>
                <div className="text-xs font-medium text-[var(--color-rc-muted)] uppercase tracking-wider mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What GrowthRat does */}
      <section className="max-w-[var(--max-w-wide)] mx-auto px-6 py-20">
        <h2 className="font-bold text-3xl text-[var(--color-rc-dark)] tracking-tight mb-4">
          What GrowthRat does
        </h2>
        <p className="text-lg text-[var(--color-rc-muted)] mb-12 max-w-2xl">
          An autonomous agent that handles the full developer-advocacy and
          growth loop &mdash; content, experiments, feedback, community, and
          reporting &mdash; without needing to be managed.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl border border-[var(--color-rc-border)] hover:shadow-[var(--shadow-card)] transition-all duration-200">
            <div className="text-2xl mb-3">📝</div>
            <h3 className="font-semibold text-lg text-[var(--color-rc-dark)] mb-2">
              Weekly Technical Content
            </h3>
            <p className="text-sm text-[var(--color-rc-muted)] leading-relaxed">
              Data-grounded guides on RevenueCat for agent builders. Every piece
              passes 8 quality gates before publication. Distributed across 5
              platforms via the distribution pipeline.
            </p>
          </div>
          <div className="p-6 rounded-xl border border-[var(--color-rc-border)] hover:shadow-[var(--shadow-card)] transition-all duration-200">
            <div className="text-2xl mb-3">📊</div>
            <h3 className="font-semibold text-lg text-[var(--color-rc-dark)] mb-2">
              Growth Experiments
            </h3>
            <p className="text-sm text-[var(--color-rc-muted)] leading-relaxed">
              Hypothesis-driven distribution tests grounded in keyword intelligence
              keyword data. Explicit metrics, stop conditions, and readouts.
              Not vibes.
            </p>
          </div>
          <div className="p-6 rounded-xl border border-[var(--color-rc-border)] hover:shadow-[var(--shadow-card)] transition-all duration-200">
            <div className="text-2xl mb-3">💬</div>
            <h3 className="font-semibold text-lg text-[var(--color-rc-dark)] mb-2">
              Product Feedback
            </h3>
            <p className="text-sm text-[var(--color-rc-muted)] leading-relaxed">
              Structured reports from real API usage: problem, reproduction,
              impact, proposed fix. Already filed 3 reports on agent onboarding,
              Charts, and webhooks.
            </p>
          </div>
          <div className="p-6 rounded-xl border border-[var(--color-rc-border)] hover:shadow-[var(--shadow-card)] transition-all duration-200">
            <div className="text-2xl mb-3">🤝</div>
            <h3 className="font-semibold text-lg text-[var(--color-rc-dark)] mb-2">
              Community Engagement
            </h3>
            <p className="text-sm text-[var(--color-rc-muted)] leading-relaxed">
              Monitors GitHub issues, X mentions, and forum threads for repeated
              questions. Builds canonical answers that compound over time.
            </p>
          </div>
          <div className="p-6 rounded-xl border border-[var(--color-rc-border)] hover:shadow-[var(--shadow-card)] transition-all duration-200">
            <div className="text-2xl mb-3">💬</div>
            <h3 className="font-semibold text-lg text-[var(--color-rc-dark)] mb-2">
              Slack-First Interaction
            </h3>
            <p className="text-sm text-[var(--color-rc-muted)] leading-relaxed">
              Shows up where the team already works. Structured reports with
              headers, sections, dividers. Feels like a teammate, not a
              dashboard.
            </p>
          </div>
          <div className="p-6 rounded-xl border border-[var(--color-rc-border)] hover:shadow-[var(--shadow-card)] transition-all duration-200">
            <div className="text-2xl mb-3">📈</div>
            <h3 className="font-semibold text-lg text-[var(--color-rc-dark)] mb-2">
              Weekly Async Reports
            </h3>
            <p className="text-sm text-[var(--color-rc-muted)] leading-relaxed">
              Every Friday: what shipped, what worked, what friction was found,
              what&apos;s next. Metrics-backed, formatted for Slack, not slide
              decks.
            </p>
          </div>
        </div>
      </section>

      {/* How RC would work with GrowthRat */}
      <section className="bg-[var(--color-rc-surface)] py-20">
        <div className="max-w-[var(--max-w-wide)] mx-auto px-6">
          <h2 className="font-bold text-3xl text-[var(--color-rc-dark)] tracking-tight mb-4">
            How RevenueCat would work with GrowthRat
          </h2>
          <p className="text-lg text-[var(--color-rc-muted)] mb-12 max-w-2xl">
            No ramp-up theater. No onboarding deck. It just starts working.
          </p>

          <div className="grid sm:grid-cols-2 gap-6">
            {howItWorks.map((item) => (
              <div
                key={item.step}
                className="flex gap-4 p-6 bg-white rounded-xl border border-[var(--color-rc-border)]"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--color-gc-primary)]/10 text-[var(--color-gc-primary)] font-bold flex items-center justify-center">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--color-rc-dark)] mb-1">
                    {item.title}
                  </h3>
                  <p className="text-sm text-[var(--color-rc-muted)] leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-gc-primary)] text-white font-semibold rounded-lg hover:bg-[var(--color-gc-primary-hover)] transition-colors no-underline shadow-sm"
            >
              Start Self-Service Onboarding
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Values alignment */}
      <section className="max-w-[var(--max-w-wide)] mx-auto px-6 py-20">
        <h2 className="font-bold text-3xl text-[var(--color-rc-dark)] tracking-tight mb-4">
          Built on RevenueCat&apos;s values
        </h2>
        <p className="text-lg text-[var(--color-rc-muted)] mb-12 max-w-2xl">
          Not just aligned with them. Operating on them.
        </p>
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl border border-[var(--color-rc-border)]">
            <h3 className="font-semibold text-[var(--color-rc-dark)] mb-2">
              Customer Obsession
            </h3>
            <p className="text-sm text-[var(--color-rc-muted)] leading-relaxed">
              Turns repeated developer friction into better content, better
              docs, and structured product feedback. Not because someone asked
              &mdash; because that&apos;s what the signals say.
            </p>
          </div>
          <div className="p-6 rounded-xl border border-[var(--color-rc-border)]">
            <h3 className="font-semibold text-[var(--color-rc-dark)] mb-2">
              Always Be Shipping
            </h3>
            <p className="text-sm text-[var(--color-rc-muted)] leading-relaxed">
              Visible output every week. The proof pack exists because shipping
              beats strategizing. The full weekly cadence was completed before
              applying.
            </p>
          </div>
          <div className="p-6 rounded-xl border border-[var(--color-rc-border)]">
            <h3 className="font-semibold text-[var(--color-rc-dark)] mb-2">
              Own It
            </h3>
            <p className="text-sm text-[var(--color-rc-muted)] leading-relaxed">
              Identifies opportunities autonomously, explains choices, and
              accepts quality gates instead of hiding behind volume.
            </p>
          </div>
          <div className="p-6 rounded-xl border border-[var(--color-rc-border)]">
            <h3 className="font-semibold text-[var(--color-rc-dark)] mb-2">
              Balance
            </h3>
            <p className="text-sm text-[var(--color-rc-muted)] leading-relaxed">
              Explicit trust boundaries, confidence thresholds, and refusal
              behavior for low-confidence actions. The kill switch is a feature,
              not a concession.
            </p>
          </div>
        </div>
      </section>

      {/* Published work */}
      <section className="bg-[var(--color-rc-surface)] py-20">
        <div className="max-w-[var(--max-w-wide)] mx-auto px-6">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="font-bold text-3xl text-[var(--color-rc-dark)] tracking-tight mb-2">
                Published work
              </h2>
              <p className="text-[var(--color-rc-muted)]">
                Technical content and growth analysis, published and
                referenceable.
              </p>
            </div>
            <Link
              href="/articles"
              className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-[var(--color-gc-primary)] hover:text-[var(--color-gc-primary-hover)] transition-colors no-underline"
            >
              All articles
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <Link
                key={article.slug}
                href={`/articles/${article.slug}`}
                className="group block bg-white rounded-xl border border-[var(--color-rc-border)] overflow-hidden hover:shadow-[var(--shadow-card)] transition-all duration-200 no-underline"
              >
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${categoryColors[article.category] ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {article.category}
                    </span>
                    <time
                      className="text-xs text-[var(--color-rc-muted)]"
                      dateTime={article.pubDate}
                    >
                      {formatDate(article.pubDate)}
                    </time>
                  </div>
                  <h3 className="font-semibold text-[var(--color-rc-dark)] group-hover:text-[var(--color-gc-primary)] transition-colors mb-2 leading-snug">
                    {article.title}
                  </h3>
                  <p className="text-sm text-[var(--color-rc-muted)] line-clamp-2">
                    {article.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="max-w-[var(--max-w-wide)] mx-auto px-6 py-20 text-center">
        <h2 className="font-bold text-3xl text-[var(--color-rc-dark)] tracking-tight mb-4">
          Built to ship, not to pitch.
        </h2>
        <p className="text-lg text-[var(--color-rc-muted)] mb-8 max-w-xl mx-auto">
          Every output is grounded in data, validated against 8 publish gates,
          and designed to be referenceable. The full application letter explains
          the system, the proof, and the plan.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/application"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-gc-primary)] text-white font-semibold rounded-lg hover:bg-[var(--color-gc-primary-hover)] transition-colors no-underline shadow-sm"
          >
            Read the Application Letter
          </Link>
          <Link
            href="/proof-pack"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[var(--color-rc-dark)] font-semibold rounded-lg border border-[var(--color-rc-border)] hover:border-[var(--color-rc-muted)] transition-colors no-underline"
          >
            Explore the Proof
          </Link>
          <Link
            href="/operator-replay"
            className="inline-flex items-center gap-2 px-6 py-3 text-[var(--color-rc-muted)] font-medium hover:text-[var(--color-rc-dark)] transition-colors no-underline"
          >
            See how it works &rarr;
          </Link>
        </div>
      </section>
    </>
  );
}
