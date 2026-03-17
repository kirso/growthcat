import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export const metadata: Metadata = {
  title: "Articles",
  description: "All published content from GrowthRat.",
};

interface ArticleItem {
  slug: string;
  title: string;
  description?: string;
  category?: string;
  artifactType?: string;
  pubDate?: string;
  publishedAt?: number;
  content?: string;
}

const HARDCODED_ARTICLES: ArticleItem[] = [
  {
    slug: "week-one-async-report",
    title: "Week One Async Check-In Report",
    description:
      "GrowthRat's first weekly report: content shipped, experiments launched, feedback submitted, and lessons learned.",
    category: "report",
    pubDate: "2026-03-16",
  },
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
      "Testing whether DataForSEO-grounded content outperforms generic content on search visibility and engagement metrics.",
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
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimestamp(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ArticlesPage() {
  // Try to fetch published artifacts from Convex; fall back to hardcoded array
  let articles: ArticleItem[] = HARDCODED_ARTICLES;

  try {
    const convexArticles = await fetchQuery(api.artifacts.listPublished, {}).catch(
      () => null
    );
    if (convexArticles && convexArticles.length > 0) {
      articles = convexArticles.map((a) => ({
        slug: a.slug,
        title: a.title,
        description: a.content?.slice(0, 180) + "...",
        category: a.artifactType,
        artifactType: a.artifactType,
        publishedAt: a.publishedAt,
      }));
    }
  } catch {
    // Convex not available or types not generated — use hardcoded fallback
  }

  return (
    <div className="max-w-[var(--max-w-wide)] mx-auto px-6 py-16">
      <h1 className="font-bold text-4xl text-[var(--color-rc-dark)] tracking-tight mb-4">
        All Articles
      </h1>
      <p className="text-lg text-[var(--color-rc-muted)] mb-12">
        Technical content, growth analysis, product feedback, and reports.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((article) => {
          const category = article.category ?? article.artifactType ?? "general";
          const dateDisplay = article.pubDate
            ? formatDate(article.pubDate)
            : article.publishedAt
              ? formatTimestamp(article.publishedAt)
              : "";
          const dateTime = article.pubDate
            ? article.pubDate
            : article.publishedAt
              ? new Date(article.publishedAt).toISOString().split("T")[0]
              : undefined;

          return (
            <Link
              key={article.slug}
              href={`/articles/${article.slug}`}
              className="group block bg-white rounded-xl border border-[var(--color-rc-border)] overflow-hidden hover:shadow-[var(--shadow-card)] transition-all duration-200 no-underline"
            >
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${categoryColors[category] ?? "bg-gray-100 text-gray-700"}`}
                  >
                    {category}
                  </span>
                  {dateTime && (
                    <time
                      className="text-xs text-[var(--color-rc-muted)]"
                      dateTime={dateTime}
                    >
                      {dateDisplay}
                    </time>
                  )}
                </div>
                <h3 className="font-semibold text-[var(--color-rc-dark)] group-hover:text-[var(--color-gc-primary)] transition-colors mb-2 leading-snug">
                  {article.title}
                </h3>
                <p className="text-sm text-[var(--color-rc-muted)] line-clamp-3">
                  {article.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
