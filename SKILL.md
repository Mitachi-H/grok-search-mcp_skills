---
name: x-search
description: >
  Real-time X (Twitter) search skill via xAI (Grok) API.
  Use when:
  (1) Looking up trends or viral posts on X/Twitter
  (2) Checking a specific user's recent posts
  (3) Researching X discourse for article or blog writing
  (4) Generating content/post ideas
  If the MCP server is connected, use the grok_search MCP tool.
  If MCP is not connected, call the xAI Responses API directly via curl.
---

# X Search Skill

## Overview

Claude alone is weak at real-time X (Twitter) search.
This skill resolves that limitation by using the xAI (Grok) API as a dedicated X search layer.

## Prerequisites

- Environment variable `XAI_API_KEY` is set
- MCP server `x-search` is connected, or `curl` is available

## Usage

### With MCP Connected

A single flexible tool is available:

| Tool | Purpose | Key Parameters |
|---|---|---|
| `grok_search` | Search X and/or the web via Grok | `prompt`, `enable_x_search`, `enable_web_search`, `from_date`, `to_date`, `allowed_handles`, `excluded_handles`, `temperature` |

The `prompt` parameter accepts any instruction — you craft the optimal search strategy, output format, and language for each use case. No hardcoded prompts.

Citations (URLs) found during search are returned alongside the response text. Use them to fetch full post content or source pages when needed.

### Without MCP (fallback)

Call the xAI Responses API directly via `curl`:

```bash
curl -s https://api.x.ai/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "model": "grok-4-1-fast",
    "temperature": 0.3,
    "input": "<YOUR_PROMPT>",
    "tools": [{"type": "x_search"}]
  }' | jq -r '.output_text // (.output[]? | select(.type == "message") | .content[]? | .text // empty)'
```

## Workflow Examples

### Quick Search

Call `grok_search` with a prompt like:
> Search X for the most relevant posts about "Claude Code" from the last 24 hours. Return up to 10 posts with URLs, author handles, 1-2 sentence summaries, and engagement metrics.

Parameters: `from_date` = yesterday, `to_date` = today

### User Post Search

Call `grok_search` with `allowed_handles: ["username"]` and a prompt like:
> Find recent posts from this user about MCP. For each post, include the URL, date, summary, and engagement metrics.

### Trend Research

Call `grok_search` with `enable_web_search: true` and a prompt like:
> Research what's being discussed about AI agents on X in the last 48 hours. Generate diverse search queries, identify recurring themes, group into clusters, and produce 5 content ideas with URLs and engagement data.

### Citation Follow-up Workflow

1. Call `grok_search` to find relevant posts
2. Review the citation URLs returned by Grok
3. Fetch important citation URLs (via web fetch) to get full post content
4. Synthesize into a comprehensive analysis

## Notes

- xAI API is pay-as-you-go (approx. $0.05--0.15 per call)
- Grok's search results are "posts Grok found on X" -- full coverage is not guaranteed
- `allowed_handles` and `excluded_handles` cannot be used together in one call
- Avoid language that looks like investment advice (no buy/sell recommendations or price targets)
- Avoid long direct quotes from posts; use summaries + URLs instead
