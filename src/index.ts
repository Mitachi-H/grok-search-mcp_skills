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
// The old search_parameters on Chat Completions was removed on Jan 12, 2026.

interface GrokResult {
  text: string;
  citations: { url: string; title?: string }[];
}

async function callGrok(
  userPrompt: string,
  options: {
    enableXSearch?: boolean;
    enableWebSearch?: boolean;
    fromDate?: string;
    toDate?: string;
    allowedHandles?: string[];
    excludedHandles?: string[];
    enableImageUnderstanding?: boolean;
    enableVideoUnderstanding?: boolean;
    temperature?: number;
  } = {}
): Promise<GrokResult> {
  const {
    enableXSearch = true,
    enableWebSearch = false,
    fromDate,
    toDate,
    allowedHandles,
    excludedHandles,
    enableImageUnderstanding = false,
    enableVideoUnderstanding = false,
    temperature = 0.3,
  } = options;

  // Build tools array for Responses API
  const tools: Record<string, unknown>[] = [];

  if (enableXSearch) {
    const xSearchTool: Record<string, unknown> = { type: "x_search" };
    if (fromDate) xSearchTool.from_date = fromDate;
    if (toDate) xSearchTool.to_date = toDate;
    if (allowedHandles?.length) xSearchTool.allowed_x_handles = allowedHandles;
    if (excludedHandles?.length)
      xSearchTool.excluded_x_handles = excludedHandles;
    if (enableImageUnderstanding)
      xSearchTool.enable_image_understanding = true;
    if (enableVideoUnderstanding)
      xSearchTool.enable_video_understanding = true;
    tools.push(xSearchTool);
  }

  if (enableWebSearch) {
    tools.push({ type: "web_search" });
  }

  const body: Record<string, unknown> = {
    model: XAI_MODEL,
    temperature,
    input: [{ role: "user", content: userPrompt }],
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

  const text = extractResponseText(data) || "(empty response from Grok)";
  const citations = data.citations ?? [];

  return { text, citations };
}

// ── Date helpers ────────────────────────────────────────────────────
function localDateISO(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function todayISO(): string {
  return localDateISO();
}
function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localDateISO(d);
}

// ── MCP Server ──────────────────────────────────────────────────────
const server = new McpServer({
  name: "x-search-mcp",
  version: "1.0.0",
});

// ─── Tool: Flexible Grok Search ────────────────────────────────────
// Single tool that gives the caller (e.g. Claude) full control over
// the prompt sent to Grok. No hardcoded prompts — the caller decides
// the search strategy, output format, and language.
server.tool(
  "grok_search",
  `Search X (Twitter) and/or the web via Grok with full prompt flexibility.
The caller controls exactly what Grok does by crafting the prompt.
Grok has access to real-time X search and web search as server-side tools.
Returns the response text and a list of citation URLs found during the search.
Use the citation URLs to access full post content or source pages when needed.`,
  {
    prompt: z
      .string()
      .describe(
        "The instruction/query to send to Grok. Craft this freely — include search intent, desired output format, language, constraints, etc."
      ),
    enable_x_search: z
      .boolean()
      .optional()
      .default(true)
      .describe("Enable X (Twitter) search (default: true)"),
    enable_web_search: z
      .boolean()
      .optional()
      .default(false)
      .describe("Enable web search (default: false)"),
    from_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
      .optional()
      .describe(
        "Search start date in YYYY-MM-DD format (e.g. '2025-01-01')"
      ),
    to_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
      .optional()
      .describe(
        "Search end date in YYYY-MM-DD format (e.g. '2025-12-31'). Defaults to today."
      ),
    allowed_handles: z
      .array(z.string())
      .max(10)
      .optional()
      .describe(
        "Limit X search to these handles only (max 10, without @). Cannot be used with excluded_handles."
      ),
    excluded_handles: z
      .array(z.string())
      .max(10)
      .optional()
      .describe(
        "Exclude these handles from X search (max 10, without @). Cannot be used with allowed_handles."
      ),
    enable_image_understanding: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Enable image understanding in X search results (default: false)"
      ),
    enable_video_understanding: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Enable video understanding in X search results (default: false)"
      ),
    temperature: z
      .number()
      .min(0)
      .max(2)
      .optional()
      .default(0.3)
      .describe("Grok temperature (default: 0.3)"),
  },
  async ({
    prompt,
    enable_x_search,
    enable_web_search,
    from_date,
    to_date,
    allowed_handles,
    excluded_handles,
    enable_image_understanding,
    enable_video_understanding,
    temperature,
  }) => {
    // ── Validation ──────────────────────────────────────────────────
    if (allowed_handles?.length && excluded_handles?.length) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: allowed_handles and excluded_handles cannot be used together.",
          },
        ],
        isError: true,
      };
    }
    if ((allowed_handles?.length ?? 0) > 10) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: allowed_handles accepts at most 10 handles.",
          },
        ],
        isError: true,
      };
    }
    if ((excluded_handles?.length ?? 0) > 10) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: excluded_handles accepts at most 10 handles.",
          },
        ],
        isError: true,
      };
    }

    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if (from_date && !DATE_RE.test(from_date)) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: from_date must be in YYYY-MM-DD format.",
          },
        ],
        isError: true,
      };
    }
    if (to_date && !DATE_RE.test(to_date)) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: to_date must be in YYYY-MM-DD format.",
          },
        ],
        isError: true,
      };
    }
    if (from_date && to_date && from_date > to_date) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: from_date must not be after to_date.",
          },
        ],
        isError: true,
      };
    }

    const result = await callGrok(prompt, {
      enableXSearch: enable_x_search,
      enableWebSearch: enable_web_search,
      fromDate: from_date,
      toDate: to_date ?? todayISO(),
      allowedHandles: allowed_handles,
      excludedHandles: excluded_handles,
      enableImageUnderstanding: enable_image_understanding,
      enableVideoUnderstanding: enable_video_understanding,
      temperature,
    });

    // Build response: main text + structured citations
    let response = result.text;

    if (result.citations.length > 0) {
      response += "\n\n---\n**Citations:**\n";
      for (const cite of result.citations) {
        response += `- ${cite.title ?? "Source"}: ${cite.url}\n`;
      }
    }

    return { content: [{ type: "text" as const, text: response }] };
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
