# x-search-mcp

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/Mitachi-H/x-search-mcp/blob/main/LICENSE)

[日本語版 README はこちら](README.ja.md)

An MCP server that enables Claude Desktop / Claude Code to search X (Twitter) in real time via the xAI (Grok) API.

## Design Philosophy

This server exposes a single, flexible `grok_search` tool with **no hardcoded prompts**. The caller (Claude, or any MCP client) crafts the prompt freely — deciding the search strategy, output format, and language. This works well because AI models like Claude can generate optimal prompts for each use case on the fly.

Citations from Grok's search are returned alongside the response text, so the caller can follow up by fetching specific post URLs or source pages for full content.

## Tool

| Tool | Purpose |
|---|---|
| `grok_search` | Search X and/or the web via Grok. The caller controls everything through the `prompt` parameter. |

### Parameters

| Parameter | Required | Default | Description |
|---|---|---|---|
| `prompt` | Yes | -- | The instruction/query to send to Grok. Include search intent, desired output format, language, constraints — anything. |
| `enable_x_search` | -- | `true` | Enable X (Twitter) search |
| `enable_web_search` | -- | `false` | Enable web search |
| `from_date` | -- | -- | Search start date (`YYYY-MM-DD`) |
| `to_date` | -- | today | Search end date (`YYYY-MM-DD`) |
| `allowed_handles` | -- | -- | Limit X search to these handles (max 10, without `@`) |
| `excluded_handles` | -- | -- | Exclude these handles from X search (max 10, without `@`) |
| `temperature` | -- | `0.3` | Grok temperature |

## Setup

### 1. Get an xAI API Key

Sign up at [https://console.x.ai/](https://console.x.ai/) and obtain an API key.
Pay-as-you-go pricing (approx. $0.05--0.15 per call). Add credits in advance.

> **Security**: Never commit your API key. Add config files (`claude_desktop_config.json`, `.mcp.json`) to `.gitignore` or manage keys via environment variables.

### 2. Install

```bash
git clone https://github.com/Mitachi-H/x-search-mcp.git
cd x-search-mcp
npm install
npm run build
```

### 3a. Use with Claude Desktop (recommended)

Add the following to `claude_desktop_config.json`:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "x-search": {
      "command": "node",
      "args": ["/path/to/x-search-mcp/dist/index.js"],
      "env": {
        "XAI_API_KEY": "xai-xxxxxxxxxxxx"
      }
    }
  }
}
```

> Replace `/path/to/` with the actual path.

Restart Claude Desktop. Then just say "Search X for ..." in a conversation and the tool is called automatically.

### 3b. Use with Claude Code

```bash
# Add to your project's .mcp.json
cat > .mcp.json << 'EOF'
{
  "mcpServers": {
    "x-search": {
      "command": "node",
      "args": ["/path/to/x-search-mcp/dist/index.js"],
      "env": {
        "XAI_API_KEY": "xai-xxxxxxxxxxxx"
      }
    }
  }
}
EOF
```

To register as a Claude Code skill, see `SKILL.md` in the `skills/` directory.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `XAI_API_KEY` | Yes | -- | xAI API key |
| `XAI_BASE_URL` | -- | `https://api.x.ai/v1` | API endpoint |
| `XAI_MODEL` | -- | `grok-4-1-fast` | Model to use (grok-4 family recommended for Responses API) |

## Usage Examples

Claude crafts the optimal Grok prompt automatically based on your request:

- "What's trending about AI agents on X?" — Claude calls `grok_search` with a prompt asking Grok to find trending AI agent posts with engagement metrics and URLs
- "Show me @hayattiq's recent posts about MCP" — Claude uses `grok_search` with `allowed_handles: ["hayattiq"]` and a prompt tailored for user post search
- "Research X discourse on Claude Code for an article I'm writing" — Claude crafts a research-oriented prompt with `enable_web_search: true` for comprehensive sourcing
- "Search X for reactions to the latest OpenAI announcement, in English" — Claude includes language preference directly in the prompt

### Workflow: Deep-dive with citation follow-up

1. Claude calls `grok_search` to find relevant posts and discussions
2. Grok returns results with citation URLs
3. Claude can then fetch specific citation URLs (via web search or web fetch) to get full post content or source pages
4. Claude synthesizes the full-text content into a comprehensive analysis

## Model Selection Guide

| Model | Speed | Cost | Use Case |
|---|---|---|---|
| `grok-4-1-fast` | Fast | Normal | Everyday search (default, recommended) |
| `grok-4-1-fast-reasoning` | Normal | High | Complex trend analysis (with reasoning) |
| `grok-4` | Slow | High | Highest-quality analysis |

> **Note**: The Responses API `x_search` / `web_search` tools are recommended for use with the grok-4 family.

## API

This server uses the xAI **Responses API** (`/v1/responses`) with server-side `x_search` / `web_search` tools.
The old Chat Completions API `search_parameters` was removed on Jan 12, 2026, so this is the correct approach.

## Architecture

```
Claude (Desktop / Code)
  └─ MCP (stdio)
       └─ x-search-mcp (this server)
            └─ xAI API (api.x.ai)
                 └─ Grok searches X in real time
```

Claude itself cannot search X effectively, but Grok -- built by xAI (the company behind X) -- excels at searching and summarizing X posts.
This MCP server acts as a bridge, using Grok as Claude's search layer.

## Acknowledgements

- [HayattiQ/x-research-skills](https://github.com/HayattiQ/x-research-skills) -- Original prompt design inspiration
- [stat-guy/grok-search-mcp](https://github.com/stat-guy/grok-search-mcp) -- Reference MCP server implementation
- [xAI API Docs](https://docs.x.ai/) -- Official xAI API documentation

## License

[MIT](LICENSE)
