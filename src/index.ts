#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ── Config ──────────────────────────────────────────────────────────
const XAI_API_KEY = process.env.XAI_API_KEY;
const XAI_BASE_URL = process.env.XAI_BASE_URL ?? "https://api.x.ai/v1";
// Responses API with x_search works best with grok-4 family.
// grok-4-1-fast is the recommended balance of speed/cost/capability.
const XAI_MODEL = process.env.XAI_MODEL ?? "grok-4-1-fast";

if (!XAI_API_KEY) {
  console.error("ERROR: XAI_API_KEY environment variable is required.");
  process.exit(1);
}

// ── Types ───────────────────────────────────────────────────────────
interface XAIResponseContent {
  type?: string;
  text?: string;
}

interface XAIResponseOutput {
  type?: string;
  text?: string;
  content?: string | XAIResponseContent[];
}

interface XAIResponse {
  id: string;
  output?: XAIResponseOutput[];
  output_text?: string;
  citations?: { url: string; title?: string }[];
  error?: { message: string };
}

function extractResponseText(data: XAIResponse): string {
  const textParts: string[] = [];
  const seen = new Set<string>();

  const pushText = (value: unknown) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    textParts.push(trimmed);
  };

  // New Responses API often exposes a convenience field.
  pushText(data.output_text);

  if (!Array.isArray(data.output)) {
    return textParts.join("\n\n");
  }

  for (const block of data.output) {
    pushText(block.text);

    if (typeof block.content === "string") {
      pushText(block.content);
      continue;
    }

    if (Array.isArray(block.content)) {
      for (const part of block.content) {
        pushText(part?.text);
      }
    }
  }

  return textParts.join("\n\n");
}

// ── xAI Responses API caller ────────────────────────────────────────
// Uses the NEW Responses API with server-side x_search/web_search tools.
// The old search_parameters on Chat Completions is deprecated (Jan 12, 2026).
async function callGrok(
  systemPrompt: string,
  userPrompt: string,
  options: {
    enableXSearch?: boolean;
    enableWebSearch?: boolean;
    fromDate?: string;
    toDate?: string;
    allowedHandles?: string[];
    temperature?: number;
  } = {}
): Promise<string> {
  const {
    enableXSearch = true,
    enableWebSearch = false,
    fromDate,
    toDate,
    allowedHandles,
    temperature = 0.3,
  } = options;

  // Build tools array for Responses API
  const tools: Record<string, unknown>[] = [];

  if (enableXSearch) {
    const xSearchTool: Record<string, unknown> = { type: "x_search" };
    if (fromDate) xSearchTool.from_date = fromDate;
    if (toDate) xSearchTool.to_date = toDate;
    if (allowedHandles?.length) xSearchTool.allowed_x_handles = allowedHandles;
    tools.push(xSearchTool);
  }

  if (enableWebSearch) {
    tools.push({ type: "web_search" });
  }

  const body: Record<string, unknown> = {
    model: XAI_MODEL,
    temperature,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    tools,
    store: false,
  };

  const res = await fetch(`${XAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`xAI API error ${res.status}: ${errBody}`);
  }

  const data = (await res.json()) as XAIResponse;

  if (data.error) {
    throw new Error(`xAI API error: ${data.error.message}`);
  }

  let result = extractResponseText(data);

  // Append citations if available
  if (data.citations?.length) {
    result += "\n\n---\n**Sources:**\n";
    for (const cite of data.citations) {
      result += `- ${cite.title ?? cite.url}: ${cite.url}\n`;
    }
  }

  return result || "(empty response from Grok)";
}

// ── Date helpers ────────────────────────────────────────────────────
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// ── MCP Server ──────────────────────────────────────────────────────
const server = new McpServer({
  name: "x-search-mcp",
  version: "1.0.0",
});

// ─── Tool 1: Quick X Search ────────────────────────────────────────
server.tool(
  "search_x",
  "Search X (Twitter) posts via Grok. Returns recent posts matching the query with engagement metrics and URLs.",
  {
    query: z
      .string()
      .describe("Search query (e.g. 'Claude Code skills', 'AI agents')"),
    hours: z
      .number()
      .int()
      .min(1)
      .optional()
      .default(24)
      .describe("How many hours back to search (default: 24)"),
    locale: z
      .enum(["ja", "en", "global"])
      .optional()
      .default("global")
      .describe("Language filter"),
  },
  async ({ query, hours, locale }) => {
    const daysBack = Math.max(1, Math.ceil(hours / 24));

    const systemPrompt = `You are an X (Twitter) search specialist.
Search X for the most relevant and high-engagement posts.

Rules:
- Return actual X post URLs when available
- Include engagement metrics (likes, retweets, views) when observable
- Summarize each post in 1-2 sentences in your own words (no long quotes)
- Sort by relevance and engagement
- If metrics are unknown, write "unknown"
- Language filter: ${locale === "global" ? "any language" : locale}
- Return up to 10 posts

Output format (for each post):
1. **URL**: (X post URL or "not found")
2. **Author**: @handle
3. **Summary**: 1-2 sentence summary
4. **Engagement**: likes=? retweets=? replies=? views=?
5. **Why notable**: 1 sentence`;

    const result = await callGrok(systemPrompt, `Search X for: ${query}`, {
      enableXSearch: true,
      fromDate: daysAgoISO(daysBack),
      toDate: todayISO(),
    });

    return { content: [{ type: "text" as const, text: result }] };
  }
);

// ─── Tool 2: X Trend Research (HayattiQ-style deep analysis) ──────
server.tool(
  "x_trend_research",
  "Deep X trend research: discovers topic clusters, representative posts, and generates content ideas. Based on HayattiQ's x-research-skills methodology.",
  {
    topic: z
      .string()
      .describe("Research topic (e.g. 'AI agents', 'Web3 DeFi')"),
    audience: z
      .enum(["engineer", "investor", "both"])
      .optional()
      .default("both")
      .describe("Target audience"),
    count: z
      .number()
      .optional()
      .default(5)
      .describe("Number of content ideas to generate (default: 5)"),
    hours: z
      .number()
      .int()
      .min(1)
      .optional()
      .default(48)
      .describe("Hours to look back (default: 48)"),
    locale: z
      .enum(["ja", "en", "global"])
      .optional()
      .default("ja")
      .describe("Language focus"),
  },
  async ({ topic, audience, count, hours, locale }) => {
    const today = todayISO();
    const daysBack = Math.max(1, Math.ceil(hours / 24));

    const localeBlock =
      locale === "ja"
        ? "\n- 日本語のX投稿を優先しつつ、英語の重要投稿も含める"
        : locale === "en"
          ? "\n- Prioritize English posts, include notable Japanese posts"
          : "\n- Search globally across languages";

    const audienceBlock =
      audience === "engineer"
        ? "エンジニア（技術的な深さ重視）"
        : audience === "investor"
          ? "投資家（事業インパクト・市場動向重視）"
          : "投資家 + エンジニア";

    const systemPrompt = `You are an X (Twitter) trend analyst specializing in real-time research.
Your goal: discover what's actually being discussed on X about the given topic, extract signal from noise, and produce actionable content ideas.

Target audience: ${audienceBlock}
Topic: ${topic}
Time range: last ${hours} hours (as of ${today})${localeBlock}

## Procedure (follow strictly):

### Step 1: Wide exploration
- Generate 12+ diverse search queries related to the topic
- Search X with each query
- Extract recurring proper nouns, feature names, and phrases
- Group into 3-5 topic clusters (ignore one-off mentions)

### Step 2: Cluster reinforcement
- Take 2-5 key phrases from Step 1
- Run additional targeted searches to validate and deepen each cluster
- For each cluster, select 2 representative posts

### Step 3: Generate ${count} content ideas
For each idea, provide:
- **Title/Angle**: compelling hook
- **Claim** (1 sentence): the core assertion
- **URL**: X post URL(s) that inspired this (or primary source URL)
- **Engagement**: observed metrics (likes, retweets, views) or "unknown"
- **Why it's trending**: hypothesis (up to 3 reasons)
- **Content idea for ${audienceBlock}**: 1 concrete post concept
- **Hook drafts**: 3 one-line hooks
- **Caution**: any disclaimers needed (especially for investment-adjacent content)

## Output format:
1. **Timeline atmosphere (topic clusters)**: 3-5 clusters, each with 2 representative post URLs and 2-3 key phrases
2. **Today's conclusion (3 themes to target)**: bullet list
3. **Content ideas**: numbered list of ${count} items
4. **URL collection**: all URLs in one list at the end

## Constraints:
- No investment advice (no buy/sell recommendations, price targets)
- Investor-oriented ideas should focus on evaluation frameworks, business impact, and market structure
- Prefer primary sources (official announcements, author's own posts) over secondhand
- Mark unverified information as "未確認/unverified"
- No long direct quotes from posts`;

    const result = await callGrok(
      systemPrompt,
      `Research X trends for: ${topic}`,
      {
        enableXSearch: true,
        enableWebSearch: true,
        fromDate: daysAgoISO(daysBack),
        toDate: today,
      }
    );

    return { content: [{ type: "text" as const, text: result }] };
  }
);

// ─── Tool 3: User Post Search ──────────────────────────────────────
server.tool(
  "search_x_user",
  "Search recent posts from a specific X (Twitter) user.",
  {
    username: z
      .string()
      .describe("X username without @ (e.g. 'elonmusk')"),
    query: z
      .string()
      .optional()
      .describe("Optional: filter by topic within user's posts"),
    days: z
      .number()
      .int()
      .min(1)
      .optional()
      .default(7)
      .describe("How many days back to search (default: 7)"),
  },
  async ({ username, query, days }) => {
    const systemPrompt = `You are an X (Twitter) search specialist.
Search for recent posts from @${username}${query ? ` about "${query}"` : ""}.
Time range: last ${days} days.

For each post found:
1. **URL**: X post URL
2. **Date**: when posted
3. **Summary**: 1-2 sentence summary (your own words)
4. **Engagement**: likes, retweets, views (if available)
5. **Thread**: note if it's part of a thread

Sort by recency. Include up to 10 posts.`;

    const result = await callGrok(
      systemPrompt,
      `Find recent posts from @${username}${query ? ` about: ${query}` : ""}`,
      {
        enableXSearch: true,
        allowedHandles: [username],
        fromDate: daysAgoISO(days),
        toDate: todayISO(),
      }
    );

    return { content: [{ type: "text" as const, text: result }] };
  }
);

// ─── Tool 4: Context Research (article writing support) ────────────
server.tool(
  "x_context_research",
  "Research context for article writing: gathers primary sources, definitions, counter-arguments, and dated facts from X and web. Inspired by HayattiQ's article-agent-context-research skill.",
  {
    topic: z.string().describe("Article topic to research"),
    goal: z
      .string()
      .optional()
      .describe("What the article aims to achieve"),
    audience: z
      .enum(["engineer", "investor", "general", "academic"])
      .optional()
      .default("general"),
    days: z
      .number()
      .int()
      .min(1)
      .optional()
      .default(30)
      .describe("Days to look back (default: 30)"),
  },
  async ({ topic, goal, audience, days }) => {
    const systemPrompt = `You are a research assistant preparing a Context Pack for article writing.
Topic: ${topic}
Goal: ${goal ?? "Provide comprehensive background for article writing"}
Audience: ${audience}
Time range: last ${days} days

## Your task: Build a Context Pack with these sections:

### 1. Key definitions & concepts
- Define core terms precisely
- Note any contested definitions

### 2. Primary sources (prioritize)
- Official announcements, blog posts, documentation
- GitHub repos, papers, official data
- For each: URL, date, 1-line summary

### 3. X (Twitter) discourse
- Search X for the topic
- What are practitioners actually saying?
- Key opinions, debates, criticisms
- Include post URLs and summarize (don't quote at length)

### 4. Counter-arguments & risks
- What are the strongest objections?
- Known limitations, failures, criticisms
- Include sources

### 5. Dated facts & numbers
- Statistics, benchmarks, market data
- Always include "As of [date]" for each fact
- Source URL required

### 6. Open questions
- What's unresolved or actively debated?
- What would strengthen the article if answered?

## Constraints:
- Primary source > secondary source > opinion
- Mark unverified claims as "未確認/unverified"
- No long direct quotes
- Include URLs for everything`;

    const result = await callGrok(
      systemPrompt,
      `Build a context research pack for: ${topic}`,
      {
        enableXSearch: true,
        enableWebSearch: true,
        fromDate: daysAgoISO(days),
        toDate: todayISO(),
      }
    );

    return { content: [{ type: "text" as const, text: result }] };
  }
);

// ── Start server ────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("x-search-mcp server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
