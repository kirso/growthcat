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
  // Core concepts
  {
    url: "https://www.revenuecat.com/docs/getting-started/quickstart",
    key: "rc-docs:quickstart",
    topic: "Getting started with RevenueCat",
  },
  {
    url: "https://www.revenuecat.com/docs/getting-started/entitlements",
    key: "rc-docs:entitlements",
    topic: "RevenueCat entitlements and access control",
  },
  // API
  {
    url: "https://www.revenuecat.com/docs/api-v2",
    key: "rc-docs:api-v2",
    topic: "RevenueCat REST API v2 reference",
  },
  // Webhooks
  {
    url: "https://www.revenuecat.com/docs/integrations/webhooks",
    key: "rc-docs:webhooks",
    topic: "RevenueCat webhook integration",
  },
  {
    url: "https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields",
    key: "rc-docs:webhook-events",
    topic: "RevenueCat webhook event types and payload fields",
  },
  // Offerings & Products
  {
    url: "https://www.revenuecat.com/docs/offerings",
    key: "rc-docs:offerings",
    topic: "RevenueCat offerings configuration",
  },
  {
    url: "https://www.revenuecat.com/docs/entitlements",
    key: "rc-docs:entitlements-guide",
    topic: "RevenueCat entitlements guide",
  },
  // SDKs
  {
    url: "https://www.revenuecat.com/docs/ios-native/installation",
    key: "rc-docs:sdk-ios",
    topic: "RevenueCat iOS SDK installation",
  },
  {
    url: "https://www.revenuecat.com/docs/android-native/installation",
    key: "rc-docs:sdk-android",
    topic: "RevenueCat Android SDK installation",
  },
  {
    url: "https://www.revenuecat.com/docs/reactnative/installation",
    key: "rc-docs:sdk-react-native",
    topic: "RevenueCat React Native SDK installation",
  },
  {
    url: "https://www.revenuecat.com/docs/flutter/installation",
    key: "rc-docs:sdk-flutter",
    topic: "RevenueCat Flutter SDK installation",
  },
  // Testing
  {
    url: "https://www.revenuecat.com/docs/test-and-launch/sandbox",
    key: "rc-docs:sandbox",
    topic: "RevenueCat sandbox and testing",
  },
];

/**
 * Fetch a page and extract text content.
 * Returns the page text stripped of HTML tags.
 */
export async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "GrowthCat Knowledge Crawler (developer advocacy agent)",
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
 * Generate an embedding for text using OpenAI text-embedding-3-small.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for embeddings");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000), // Max input for embedding model
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI embedding error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
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
