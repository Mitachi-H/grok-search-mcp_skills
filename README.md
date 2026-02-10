# x-search-mcp

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/Mitachi-H/x-search-mcp/blob/main/LICENSE)

[日本語版 README はこちら](README.ja.md)

An MCP server that enables Claude Desktop / Claude Code to search X (Twitter) in real time via the xAI (Grok) API.

Re-implements the prompt design from [HayattiQ/x-research-skills](https://github.com/HayattiQ/x-research-skills) as MCP tools.

## Tools

| Tool | Purpose |
|---|---|
| `search_x` | Quick search for X posts. Filter by keyword and time range |
| `x_trend_research` | Deep trend analysis. Cluster extraction, representative post selection, and content idea generation |
| `search_x_user` | Search recent posts from a specific user |
| `x_context_research` | Build a context pack for article writing (primary sources, counter-arguments, key figures) |

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

Just ask Claude naturally:

- "What's trending about AI agents on X?" -> `search_x`
- "Deep-dive into Claude Code trends and suggest 5 post ideas" -> `x_trend_research`
- "Show me @hayattiq's recent posts" -> `search_x_user`
- "I'm writing an article on BMI tech -- do a context research" -> `x_context_research`

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

- [HayattiQ/x-research-skills](https://github.com/HayattiQ/x-research-skills) -- Original prompt design and X research skill structure
- [stat-guy/grok-search-mcp](https://github.com/stat-guy/grok-search-mcp) -- Reference MCP server implementation
- [xAI API Docs](https://docs.x.ai/) -- Official xAI API documentation

## License

[MIT](LICENSE)
