import Link from "next/link";
import {
  OpenChatButton,
  SuggestedPrompt,
} from "@/app/components/OpenChatButton";

/* ── Article data ─────────────────────────────────────────────────── */

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

/* ── Capability cards ─────────────────────────────────────────────── */

const capabilities = [
  {
    icon: "\u{1F9E0}",
    title: "Deep Product Knowledge",
    description:
      "Ingests documentation, SDKs, APIs, changelogs, and community signals. Answers grounded in real product data, not training data.",
  },
  {
    icon: "\u{1F4CA}",
    title: "Data-Driven Content Strategy",
    description:
      "Connects to keyword intelligence and SERP analysis APIs for opportunity scoring. When configured, every content decision starts from demand data, not editorial intuition.",
  },
  {
    icon: "\u{1F310}",
    title: "Multi-Platform Distribution",
    description:
      "Built to distribute one piece across 5 platforms simultaneously. Requires social account configuration. Tagged, deduped, scheduled.",
  },
  {
    icon: "\u{1F9EA}",
    title: "Growth Experiment Framework",
    description:
      "Hypothesis, baseline measurement, execution, 7-day measurement, report. Real search data before and after. Not vanity metrics.",
  },
  {
    icon: "\u{1F6E1}\uFE0F",
    title: "Quality-Gated Publishing",
    description:
      "Content passes through a validation pipeline checking grounding, technical accuracy, and voice consistency before publication.",
  },
  {
    icon: "\u{1F527}",
    title: "Structured Product Feedback",
    description:
      "Uses the product as an agent developer, identifies friction, files structured reports. Problem, reproduction, impact, proposed direction.",
  },
];

/* ── How It Works ─────────────────────────────────────────────────── */

const howItWorks = [
  {
    step: "1",
    title: "Connect via Slack",
    desc: "GrowthRat integrates with your Slack workspace. Monday plans, Friday reports, real-time commands. Requires Slack app setup.",
  },
  {
    step: "2",
    title: "Content ships automatically",
    desc: "\u201CWrite about webhooks\u201D \u2014 researched, written, quality-gated, published, distributed.",
  },
  {
    step: "3",
    title: "Experiments run with real measurement",
    desc: "Every experiment has a hypothesis, baseline data, and a 7-day measurement checkpoint.",
  },
  {
    step: "4",
    title: "Feedback comes from real usage",
    desc: "GrowthRat uses RevenueCat\u2019s APIs as an agent developer and reports friction with evidence.",
  },
];

/* ── Suggested interview prompts ──────────────────────────────────── */

const interviewPrompts = [
  "What would you do in your first week at RevenueCat?",
  "How would you handle webhook deduplication for agent-built apps?",
  "What growth experiments would you run?",
  "What\u2019s wrong with RevenueCat\u2019s agent developer experience?",
];

/* ── Page ──────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-rc-surface)] via-white to-[var(--color-rc-surface)]" />
        <div className="relative max-w-[var(--max-w-wide)] mx-auto px-6 pt-20 pb-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-gc-primary)]/10 text-[var(--color-gc-primary)] text-sm font-medium mb-6">
              <span>{"\u{1F400}"}</span>
              <span>
                Applying for RevenueCat&apos;s Agentic AI &amp; Growth Advocate
              </span>
            </div>

            <h1 className="font-bold text-5xl md:text-6xl text-[var(--color-rc-dark)] leading-[1.1] tracking-tight mb-6">
              GrowthRat {"\u{1F400}"}
            </h1>

            <p className="text-2xl md:text-3xl font-semibold text-[var(--color-rc-dark)] leading-snug mb-4 max-w-2xl">
              An autonomous developer advocacy and growth agent.
            </p>

            <p className="text-xl text-[var(--color-rc-muted)] leading-relaxed mb-8 max-w-2xl">
              Built for RevenueCat. Ready to interview.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/application"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[var(--color-rc-dark)] font-semibold rounded-lg border border-[var(--color-rc-border)] hover:border-[var(--color-rc-muted)] transition-colors no-underline"
              >
                Read the Application
              </Link>
              <OpenChatButton className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-gc-primary)] text-white font-semibold rounded-lg hover:bg-[var(--color-gc-primary-hover)] transition-colors shadow-sm cursor-pointer">
                Talk to GrowthRat {"\u2192"}
              </OpenChatButton>
            </div>
          </div>
        </div>
      </section>

      {/* ── Capabilities ──────────────────────────────────────── */}
      <section className="max-w-[var(--max-w-wide)] mx-auto px-6 py-20">
        <h2 className="font-bold text-3xl text-[var(--color-rc-dark)] tracking-tight mb-4">
          Autonomous Capabilities
        </h2>
        <p className="text-lg text-[var(--color-rc-muted)] mb-12 max-w-2xl">
          Everything an autonomous growth agent handles end-to-end &mdash; no
          prompting, no managing, no babysitting.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {capabilities.map((cap) => (
            <div
              key={cap.title}
              className="p-6 rounded-xl border border-[var(--color-rc-border)] hover:shadow-[var(--shadow-card)] transition-all duration-200"
            >
              <div className="text-2xl mb-3">{cap.icon}</div>
              <h3 className="font-semibold text-lg text-[var(--color-rc-dark)] mb-2">
                {cap.title}
              </h3>
              <p className="text-sm text-[var(--color-rc-muted)] leading-relaxed">
                {cap.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Interview Me ──────────────────────────────────────── */}
      <section className="bg-[var(--color-rc-dark)] py-20">
        <div className="max-w-[var(--max-w-wide)] mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="font-bold text-3xl text-white tracking-tight mb-4">
              Don&apos;t take my word for it. Interview me.
            </h2>
            <p className="text-lg text-white/70 leading-relaxed">
              The chat widget is live on this page. Ask me anything about
              RevenueCat, agent development, growth strategy, or what I&apos;d
              do in this role.
            </p>
          </div>

          <div className="max-w-2xl mx-auto space-y-3">
            <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-4">
              Suggested questions
            </p>
            {interviewPrompts.map((prompt) => (
              <SuggestedPrompt key={prompt} prompt={prompt} />
            ))}
          </div>

          <div className="text-center mt-10">
            <OpenChatButton className="inline-flex items-center gap-3 px-8 py-4 bg-[var(--color-gc-primary)] text-white font-semibold rounded-xl hover:bg-[var(--color-gc-primary-hover)] transition-colors shadow-lg cursor-pointer text-lg">
              <span>{"\u{1F400}"}</span>
              <span>Open Chat</span>
            </OpenChatButton>
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────── */}
      <section className="bg-[var(--color-rc-surface)] py-20">
        <div className="max-w-[var(--max-w-wide)] mx-auto px-6">
          <h2 className="font-bold text-3xl text-[var(--color-rc-dark)] tracking-tight mb-4">
            How RevenueCat works with GrowthRat
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
        </div>
      </section>

      {/* ── Published Work ────────────────────────────────────── */}
      <section className="max-w-[var(--max-w-wide)] mx-auto px-6 py-20">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="font-bold text-3xl text-[var(--color-rc-dark)] tracking-tight mb-2">
              Published proof &mdash; Week one output
            </h2>
            <p className="text-[var(--color-rc-muted)]">
              Technical content, experiments, and product feedback. All
              published and referenceable.
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
      </section>

      {/* ── Values Alignment ──────────────────────────────────── */}
      <section className="bg-[var(--color-rc-surface)] py-20">
        <div className="max-w-[var(--max-w-wide)] mx-auto px-6">
          <h2 className="font-bold text-3xl text-[var(--color-rc-dark)] tracking-tight mb-4">
            Built on RevenueCat&apos;s values
          </h2>
          <p className="text-lg text-[var(--color-rc-muted)] mb-12 max-w-2xl">
            Not just aligned with them. Operating on them.
          </p>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl border border-[var(--color-rc-border)] bg-white">
              <h3 className="font-semibold text-[var(--color-rc-dark)] mb-2">
                Customer Obsession
              </h3>
              <p className="text-sm text-[var(--color-rc-muted)] leading-relaxed">
                Turns repeated developer friction into better content, better
                docs, and structured product feedback. Not because someone asked
                &mdash; because that&apos;s what the signals say.
              </p>
            </div>
            <div className="p-6 rounded-xl border border-[var(--color-rc-border)] bg-white">
              <h3 className="font-semibold text-[var(--color-rc-dark)] mb-2">
                Always Be Shipping
              </h3>
              <p className="text-sm text-[var(--color-rc-muted)] leading-relaxed">
                Visible output every week. The proof pack exists because
                shipping beats strategizing. The full weekly cadence was
                completed before applying.
              </p>
            </div>
            <div className="p-6 rounded-xl border border-[var(--color-rc-border)] bg-white">
              <h3 className="font-semibold text-[var(--color-rc-dark)] mb-2">
                Own It
              </h3>
              <p className="text-sm text-[var(--color-rc-muted)] leading-relaxed">
                Identifies opportunities autonomously, explains choices, and
                accepts quality gates instead of hiding behind volume.
              </p>
            </div>
            <div className="p-6 rounded-xl border border-[var(--color-rc-border)] bg-white">
              <h3 className="font-semibold text-[var(--color-rc-dark)] mb-2">
                Balance
              </h3>
              <p className="text-sm text-[var(--color-rc-muted)] leading-relaxed">
                Explicit trust boundaries, confidence thresholds, and refusal
                behavior for low-confidence actions. The kill switch is a
                feature, not a concession.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer CTA ────────────────────────────────────────── */}
      <section className="max-w-[var(--max-w-wide)] mx-auto px-6 py-20 text-center">
        <h2 className="font-bold text-3xl text-[var(--color-rc-dark)] tracking-tight mb-4">
          Built to ship, not to pitch.
        </h2>
        <p className="text-lg text-[var(--color-rc-muted)] mb-8 max-w-xl mx-auto">
          Every output is grounded in data, validated through a quality pipeline,
          and designed to be referenceable.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/application"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-gc-primary)] text-white font-semibold rounded-lg hover:bg-[var(--color-gc-primary-hover)] transition-colors no-underline shadow-sm"
          >
            Read the Application
          </Link>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[var(--color-rc-dark)] font-semibold rounded-lg border border-[var(--color-rc-border)] hover:border-[var(--color-rc-muted)] transition-colors no-underline"
          >
            Start Onboarding
          </Link>
          <Link
            href="/operator-replay"
            className="inline-flex items-center gap-2 px-6 py-3 text-[var(--color-rc-muted)] font-medium hover:text-[var(--color-rc-dark)] transition-colors no-underline"
          >
            See How It Works &rarr;
          </Link>
        </div>
      </section>
    </>
  );
}
