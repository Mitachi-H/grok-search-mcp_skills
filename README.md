# x-search-mcp

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/Mitachi-H/x-search-mcp/blob/main/LICENSE)

Claude Desktop / Claude Code から xAI (Grok) API 経由で X (Twitter) をリアルタイム検索する MCP サーバー。

[HayattiQ/x-research-skills](https://github.com/HayattiQ/x-research-skills) のプロンプト設計を MCP ツールとして再実装。

## 提供ツール

| Tool | 用途 |
|---|---|
| `search_x` | X投稿のクイック検索。キーワード+期間で絞り込み |
| `x_trend_research` | トレンド深掘り。クラスター抽出→代表ポスト選定→コンテンツアイデア生成 |
| `search_x_user` | 特定ユーザーの最近の投稿を検索 |
| `x_context_research` | 記事執筆用のコンテキストパック作成（一次情報、反論、数字を収集） |

## セットアップ

### 1. xAI API Key を取得

[https://console.x.ai/](https://console.x.ai/) でサインアップし、API Key を取得。
従量課金制（1回の呼び出し ≈ $0.05–0.15）。あらかじめクレジットを追加しておく。

> **セキュリティ注意**: API キーは絶対にコミットしないでください。設定ファイル（`claude_desktop_config.json` や `.mcp.json`）は `.gitignore` に追加するか、環境変数で管理してください。

### 2. インストール

```bash
git clone https://github.com/Mitachi-H/x-search-mcp.git
cd x-search-mcp
npm install
npm run build
```

### 3a. Claude Desktop App で使う（推奨）

`claude_desktop_config.json` に以下を追加：

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

> `/path/to/` は実際のパスに置き換える。

Claude Desktop を再起動すると、会話中に「X で〇〇を検索して」と言うだけで自動的にツールが呼ばれる。

### 3b. Claude Code で使う

```bash
# プロジェクトの .mcp.json に追加
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

または、Claude Code のスキルとして登録する場合は `skills/` ディレクトリの `SKILL.md` を参照。

## 環境変数

| 変数 | 必須 | デフォルト | 説明 |
|---|---|---|---|
| `XAI_API_KEY` | ✅ | — | xAI API キー |
| `XAI_BASE_URL` | — | `https://api.x.ai/v1` | API エンドポイント |
| `XAI_MODEL` | — | `grok-4-1-fast` | 使用モデル（Responses API は grok-4 ファミリー推奨） |

## 使い方の例

Claude Desktop で以下のように聞くだけ:

- 「AI agents について X で何が話題になってる？」 → `search_x` が呼ばれる
- 「Claude Code のトレンドを深掘りして、投稿ネタを5つ出して」 → `x_trend_research` が呼ばれる
- 「@hayattiq の最近の投稿を見せて」 → `search_x_user` が呼ばれる
- 「BMI技術について記事を書くので、コンテキストリサーチして」 → `x_context_research` が呼ばれる

## モデル選択の目安

| モデル | 速度 | コスト | 用途 |
|---|---|---|---|
| `grok-4-1-fast` | ◎ 速い | ○ 普通 | 日常的な検索（デフォルト・推奨） |
| `grok-4-1-fast-reasoning` | ○ 普通 | △ 高い | 複雑なトレンド分析（推論あり） |
| `grok-4` | △ 遅い | △ 高い | 最高品質の分析 |

> **注意**: Responses API の `x_search` / `web_search` ツールは grok-4 ファミリーでの利用が推奨。

## API について

このサーバーは xAI の **Responses API** (`/v1/responses`) + サーバーサイド `x_search` / `web_search` ツールを使用。
旧 Chat Completions API の `search_parameters` は 2026年1月12日に廃止予定のため、こちらが正しいアプローチ。

## アーキテクチャ

```
Claude (Desktop / Code)
  └─ MCP (stdio)
       └─ x-search-mcp (この サーバー)
            └─ xAI API (api.x.ai)
                 └─ Grok が X をリアルタイム検索
```

ポイント: Claude 自体は X を検索できないが、Grok は X 社製なので X 投稿の検索・要約が圧倒的に強い。
この MCP サーバーは「Grok を Claude の検索レイヤーとして使う」ブリッジ。

## 謝辞

- [HayattiQ/x-research-skills](https://github.com/HayattiQ/x-research-skills) — プロンプト設計の元ネタ。X リサーチのスキル構成を参考にした
- [stat-guy/grok-search-mcp](https://github.com/stat-guy/grok-search-mcp) — 類似の MCP サーバー実装を参考にした
- [xAI API Docs](https://docs.x.ai/) — xAI API 公式ドキュメント

## ライセンス

[MIT](LICENSE)
