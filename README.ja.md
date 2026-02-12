# x-search-mcp

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/Mitachi-H/x-search-mcp/blob/main/LICENSE)

[English README](README.md)

Claude Desktop / Claude Code から xAI (Grok) API 経由で X (Twitter) をリアルタイム検索する MCP サーバー。

## 設計思想

**ハードコーディングされたプロンプトなし**。単一の `grok_search` ツールを通じて、呼び出し側（Claude など）がプロンプトを自由に組み立てる設計。Claude のような AI モデルはユースケースに応じて最適なプロンプトをその場で生成できるため、固定プロンプトは不要。

Grok の検索で見つかったサイテーション（URL）もレスポンスと一緒に返されるので、必要に応じて特定のポスト URL やソースページにアクセスして全文を取得するワークフローも可能。

## 提供ツール

| Tool | 用途 |
|---|---|
| `grok_search` | X や Web を Grok 経由で検索。`prompt` パラメータで全てをコントロール。 |

### パラメータ

| パラメータ | 必須 | デフォルト | 説明 |
|---|---|---|---|
| `prompt` | ✅ | — | Grok に送るプロンプト。検索意図、出力形式、言語、制約など自由に指定。 |
| `enable_x_search` | — | `true` | X (Twitter) 検索の有効化 |
| `enable_web_search` | — | `false` | Web 検索の有効化 |
| `from_date` | — | — | 検索開始日 (`YYYY-MM-DD`) |
| `to_date` | — | 今日 | 検索終了日 (`YYYY-MM-DD`) |
| `allowed_handles` | — | — | 検索対象を特定ハンドルに限定（最大10、`@` なし） |
| `excluded_handles` | — | — | 特定ハンドルを検索から除外（最大10、`@` なし） |
| `temperature` | — | `0.3` | Grok の temperature |

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

Claude がリクエストに応じて最適なプロンプトを自動生成する：

- 「AI agents について X で何が話題になってる？」 → Claude が `grok_search` をトレンド検索プロンプト付きで呼び出す
- 「@hayattiq の最近の MCP 関連の投稿を見せて」 → `allowed_handles: ["hayattiq"]` と適切なプロンプトで呼び出す
- 「Claude Code について記事を書くので X の議論をリサーチして」 → `enable_web_search: true` でリサーチ用プロンプトを生成
- 「最新の OpenAI 発表への反応を英語で検索して」 → 英語指定をプロンプトに含めて呼び出す

### ワークフロー例：サイテーション活用の深掘り

1. Claude が `grok_search` で関連投稿やディスカッションを検索
2. Grok がサイテーション URL 付きで結果を返す
3. Claude が重要なサイテーション URL に Web アクセスして全文を取得
4. Claude が全文を踏まえた総合的な分析を作成

## モデル選択の目安

| モデル | 速度 | コスト | 用途 |
|---|---|---|---|
| `grok-4-1-fast` | ◎ 速い | ○ 普通 | 日常的な検索（デフォルト・推奨） |
| `grok-4-1-fast-reasoning` | ○ 普通 | △ 高い | 複雑なトレンド分析（推論あり） |
| `grok-4` | △ 遅い | △ 高い | 最高品質の分析 |

> **注意**: Responses API の `x_search` / `web_search` ツールは grok-4 ファミリーでの利用が推奨。

## API について

このサーバーは xAI の **Responses API** (`/v1/responses`) + サーバーサイド `x_search` / `web_search` ツールを使用。
旧 Chat Completions API の `search_parameters` は 2026年1月12日に廃止済みのため、こちらが正しいアプローチ。

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

- [HayattiQ/x-research-skills](https://github.com/HayattiQ/x-research-skills) — プロンプト設計のインスピレーション元
- [stat-guy/grok-search-mcp](https://github.com/stat-guy/grok-search-mcp) — 類似の MCP サーバー実装を参考にした
- [xAI API Docs](https://docs.x.ai/) — xAI API 公式ドキュメント

## ライセンス

[MIT](LICENSE)
