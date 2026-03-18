/**
 * Knowledge Crawler — fetches, chunks, and embeds RevenueCat documentation.
 *
 * This is the ingestion pipeline for VS-A1 (The Brain Works).
 * It crawls RC docs, splits them into ~500-token chunks with overlap,
 * generates embeddings via OpenAI, and returns structured source records
 * ready to be stored in Convex.
 *
 * IMPORTANT: This runs in Inngest functions (server-side), NOT in the browser.
 */

export interface SourceChunk {
  key: string; // e.g., "rc-docs:webhooks:chunk-0"
  url: string;
  provider: string;
  sourceClass: string;
  evidenceTier: string;
  contentHash: string;
  summary: string;
  embedding: number[];
  chunkIndex: number;
  parentKey: string; // e.g., "rc-docs:webhooks"
}

/**
 * RevenueCat documentation pages to crawl.
 * These are the most important pages for agent-developer knowledge.
 */
export const RC_DOC_URLS: { url: string; key: string; topic: string }[] = [
  // ── Getting Started ──
  { url: "https://www.revenuecat.com/docs/getting-started/quickstart", key: "rc-docs:quickstart", topic: "Getting started with RevenueCat" },
  { url: "https://www.revenuecat.com/docs/getting-started/entitlements", key: "rc-docs:entitlements", topic: "RevenueCat entitlements and access control" },
  { url: "https://www.revenuecat.com/docs/projects/overview", key: "rc-docs:projects", topic: "RevenueCat projects overview" },
  { url: "https://www.revenuecat.com/docs/projects/collaborators", key: "rc-docs:collaborators", topic: "RevenueCat project collaborators and permissions" },

  // ── Products & Offerings ──
  { url: "https://www.revenuecat.com/docs/offerings", key: "rc-docs:offerings", topic: "RevenueCat offerings configuration" },
  { url: "https://www.revenuecat.com/docs/entitlements", key: "rc-docs:entitlements-guide", topic: "RevenueCat entitlements guide" },
  { url: "https://www.revenuecat.com/docs/subscription-guidance/subscription-offers", key: "rc-docs:subscription-offers", topic: "RevenueCat subscription offers and promotions" },

  // ── Customers ──
  { url: "https://www.revenuecat.com/docs/customers/customer-info", key: "rc-docs:customer-info", topic: "RevenueCat CustomerInfo object and subscriber attributes" },
  { url: "https://www.revenuecat.com/docs/customers/user-ids", key: "rc-docs:user-ids", topic: "RevenueCat user identification and app user IDs" },

  // ── Making Purchases ──
  { url: "https://www.revenuecat.com/docs/making-purchases", key: "rc-docs:purchases", topic: "Making purchases with RevenueCat SDKs" },
  { url: "https://www.revenuecat.com/docs/subscription-guidance/managing-subscriptions", key: "rc-docs:managing-subs", topic: "Managing subscriptions with RevenueCat" },

  // ── Paywalls ──
  { url: "https://www.revenuecat.com/docs/tools/paywalls", key: "rc-docs:paywalls", topic: "RevenueCat Paywalls — remote paywall configuration" },
  { url: "https://www.revenuecat.com/docs/tools/paywalls/creating-paywalls", key: "rc-docs:creating-paywalls", topic: "Creating and configuring RevenueCat paywalls" },

  // ── API v2 ──
  { url: "https://www.revenuecat.com/docs/api-v2", key: "rc-docs:api-v2", topic: "RevenueCat REST API v2 reference" },

  // ── Webhooks ──
  { url: "https://www.revenuecat.com/docs/integrations/webhooks", key: "rc-docs:webhooks", topic: "RevenueCat webhook integration" },
  { url: "https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields", key: "rc-docs:webhook-events", topic: "RevenueCat webhook event types and payload fields" },

  // ── Charts & Analytics ──
  { url: "https://www.revenuecat.com/docs/dashboard-and-metrics/charts", key: "rc-docs:charts", topic: "RevenueCat Charts — subscription analytics dashboard" },
  { url: "https://www.revenuecat.com/docs/dashboard-and-metrics/customer-lists", key: "rc-docs:customer-lists", topic: "RevenueCat customer lists and segments" },

  // ── SDKs ──
  { url: "https://www.revenuecat.com/docs/ios-native/installation", key: "rc-docs:sdk-ios", topic: "RevenueCat iOS SDK installation" },
  { url: "https://www.revenuecat.com/docs/android-native/installation", key: "rc-docs:sdk-android", topic: "RevenueCat Android SDK installation" },
  { url: "https://www.revenuecat.com/docs/reactnative/installation", key: "rc-docs:sdk-react-native", topic: "RevenueCat React Native SDK installation" },
  { url: "https://www.revenuecat.com/docs/flutter/installation", key: "rc-docs:sdk-flutter", topic: "RevenueCat Flutter SDK installation" },
  { url: "https://www.revenuecat.com/docs/web/web-sdk", key: "rc-docs:sdk-web", topic: "RevenueCat Web SDK for browser and server" },
  { url: "https://www.revenuecat.com/docs/unity/installation", key: "rc-docs:sdk-unity", topic: "RevenueCat Unity SDK installation" },

  // ── Testing & Launch ──
  { url: "https://www.revenuecat.com/docs/test-and-launch/sandbox", key: "rc-docs:sandbox", topic: "RevenueCat sandbox and testing" },
  { url: "https://www.revenuecat.com/docs/test-and-launch/launch-checklist", key: "rc-docs:launch-checklist", topic: "RevenueCat launch checklist" },

  // ── Integrations ──
  { url: "https://www.revenuecat.com/docs/integrations/attribution/branch", key: "rc-docs:integration-branch", topic: "RevenueCat Branch integration" },
  { url: "https://www.revenuecat.com/docs/integrations/scheduled-data-exports", key: "rc-docs:data-exports", topic: "RevenueCat scheduled data exports" },

  // ── Migration ──
  { url: "https://www.revenuecat.com/docs/migrating-to-revenuecat/migration-overview", key: "rc-docs:migration", topic: "Migrating to RevenueCat from other billing systems" },

  // ── Platform-specific ──
  { url: "https://www.revenuecat.com/docs/getting-started/configuring-sdk/ios-app-store", key: "rc-docs:config-ios", topic: "Configuring RevenueCat for iOS App Store" },
  { url: "https://www.revenuecat.com/docs/getting-started/configuring-sdk/google-play-store", key: "rc-docs:config-android", topic: "Configuring RevenueCat for Google Play Store" },
  { url: "https://www.revenuecat.com/docs/getting-started/configuring-sdk/stripe", key: "rc-docs:config-stripe", topic: "Configuring RevenueCat with Stripe for web" },
];

/**
 * Fetch a page and extract text content.
 * Returns the page text stripped of HTML tags.
 */
export async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "GrowthRat Knowledge Crawler (developer advocacy agent)",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const html = await response.text();

  // Strip HTML tags, scripts, styles
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Limit to reasonable size
  if (text.length > 50000) {
    text = text.slice(0, 50000);
  }

  return text;
}

/**
 * Split text into chunks of ~500 tokens (~2000 chars) with 50 token overlap.
 */
export function chunkText(
  text: string,
  chunkSize = 2000,
  overlap = 200
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();

    if (chunk.length > 50) {
      // Skip tiny chunks
      chunks.push(chunk);
    }

    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}

/**
 * Generate an embedding using Voyage AI (voyage-3-lite, 1024 dimensions).
 * Falls back to OpenAI text-embedding-3-small if Voyage key not set.
 * Voyage free tier: 200M tokens.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const voyageKey = process.env.VOYAGE_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (voyageKey) {
    // Voyage AI — free 200M tokens
    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${voyageKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "voyage-3-lite",
        input: [text.slice(0, 16000)],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Voyage embedding error: ${response.status} ${error.slice(0, 200)}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  if (openaiKey) {
    // OpenAI fallback
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI embedding error: ${response.status} ${error.slice(0, 200)}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  throw new Error("No embedding API key configured. Set VOYAGE_API_KEY or OPENAI_API_KEY.");
}

/**
 * Hash text content for dedup (avoid re-embedding unchanged content).
 */
export function hashContent(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(36);
}

/**
 * Process a single RC doc page: fetch → chunk → embed → return source records.
 */
export async function processPage(page: {
  url: string;
  key: string;
  topic: string;
}): Promise<SourceChunk[]> {
  const text = await fetchPage(page.url);
  const chunks = chunkText(text);
  const results: SourceChunk[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const contentHash = hashContent(chunk);

    const embedding = await generateEmbedding(chunk);

    results.push({
      key: `${page.key}:chunk-${i}`,
      url: page.url,
      provider: "RevenueCat",
      sourceClass: "public_product",
      evidenceTier: "public_product_and_competitor",
      contentHash,
      summary: chunk,
      embedding,
      chunkIndex: i,
      parentKey: page.key,
    });
  }

  return results;
}
