---
name: x-search
description: >
  Real-time X (Twitter) search skill via xAI (Grok) API.
  Use when:
  (1) Looking up trends or viral posts on X/Twitter
  (2) Checking a specific user's recent posts
  (3) Researching X discourse for article or blog writing
  (4) Generating content/post ideas
  If the MCP server is connected, use MCP tools (search_x, x_trend_research, search_x_user, x_context_research).
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

The following MCP tools are available:

| Tool | Purpose | Key Parameters |
|---|---|---|
| `search_x` | Quick search | `query`, `hours`, `locale` |
| `x_trend_research` | Deep trend analysis | `topic`, `audience`, `count`, `hours`, `locale` |
| `search_x_user` | User post search | `username`, `query`, `days` |
| `x_context_research` | Article research | `topic`, `goal`, `audience`, `days` |

### Without MCP (fallback)

Call the xAI Responses API directly via `curl`:

```bash
curl -s https://api.x.ai/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "model": "grok-4-1-fast",
    "temperature": 0.3,
    "instructions": "<SYSTEM_PROMPT>",
    "input": "<USER_QUERY>",
    "tools": [{"type": "x_search"}]
  }' | jq -r '.output_text // (.output[]? | select(.type == "message") | .content[]? | .text // empty)'
```

## Prompt Templates

### Quick Search system prompt

```
You are an X (Twitter) search specialist.
Search X for the most relevant and high-engagement posts.
Return actual X post URLs when available.
Include engagement metrics (likes, retweets, views) when observable.
Summarize each post in 1-2 sentences (no long quotes).
Sort by relevance and engagement.
Language: {locale}
Time range: last {hours} hours
```

### Trend Research system prompt

```
You are an X trend analyst.
1) Generate 12+ search queries for the topic
2) Search X, extract recurring terms, group into 3-5 clusters
3) Reinforce clusters with targeted searches
4) Select 2 representative posts per cluster
5) Generate {count} content ideas with:
   - Title, Claim, URL, Engagement, Why trending
   - Content idea, Hook drafts (3), Cautions
Output: clusters -> themes -> ideas -> URL list
No investment advice. Primary sources preferred. Mark unverified claims.
```

## Workflow Examples

### Content Ideation

1. Run `x_trend_research` with topic=your area, audience=both, count=5
2. Review the returned clusters and ideas
3. Use `search_x` for deeper dives on interesting ideas
4. Use `search_x_user` to check the original poster's other posts for context

### Pre-Article Research

1. Run `x_context_research` with topic=article theme, days=30
2. Use the returned Context Pack as the backbone of your article
3. Fill gaps with `search_x` for additional primary sources

## Notes

- xAI API is pay-as-you-go (approx. $0.05--0.15 per call)
- Grok's search results are "posts Grok found on X" -- full coverage is not guaranteed
- Avoid language that looks like investment advice (no buy/sell recommendations or price targets)
- Avoid long direct quotes from posts; use summaries + URLs instead
