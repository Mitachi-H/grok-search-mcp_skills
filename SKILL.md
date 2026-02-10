---
name: x-search
description: >
  X (Twitter) リアルタイム検索スキル。xAI (Grok) API を経由して X の投稿を検索・分析する。
  以下のケースで使う:
  (1) X/Twitter のトレンドやバズ投稿を調べたいとき
  (2) 特定ユーザーの最近の投稿を確認したいとき
  (3) 記事やブログ執筆のために X 上の言説をリサーチしたいとき
  (4) 投稿ネタのアイデア出しをしたいとき
  MCP サーバーが接続済みなら MCP ツール (search_x, x_trend_research, search_x_user, x_context_research) を使う。
  MCP 未接続なら curl で xAI Responses API を直接実行する。
---

# X Search Skill

## 概要

Claude 単体では X (Twitter) のリアルタイム検索が弱い。
このスキルは xAI (Grok) API を「X 検索専用レイヤー」として挟むことで、その制約を解消する。

## 前提条件

- 環境変数 `XAI_API_KEY` が設定されていること
- MCP サーバー `x-search` が接続済み、または `curl` が使えること

## 使い方

### MCP 接続済みの場合

以下の MCP ツールが利用可能:

| ツール | 用途 | 主要パラメータ |
|---|---|---|
| `search_x` | クイック検索 | `query`, `hours`, `locale` |
| `x_trend_research` | トレンド深掘り | `topic`, `audience`, `count`, `hours`, `locale` |
| `search_x_user` | ユーザー投稿検索 | `username`, `query`, `days` |
| `x_context_research` | 記事用リサーチ | `topic`, `goal`, `audience`, `days` |

### MCP 未接続の場合 (fallback)

直接 xAI Responses API を叩く。以下のパターンで `curl` を使う:

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

## プロンプトテンプレート

### クイック検索用 system prompt

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

### トレンド深掘り用 system prompt

```
You are an X trend analyst.
1) Generate 12+ search queries for the topic
2) Search X, extract recurring terms, group into 3-5 clusters
3) Reinforce clusters with targeted searches
4) Select 2 representative posts per cluster
5) Generate {count} content ideas with:
   - Title, Claim, URL, Engagement, Why trending
   - Content idea, Hook drafts (3), Cautions
Output: clusters → themes → ideas → URL list
No investment advice. Primary sources preferred. Mark unverified claims.
```

## ワークフロー例

### 投稿ネタ出し

1. `x_trend_research` で topic=対象領域, audience=both, count=5 を実行
2. 返ってきたクラスターとアイデアを確認
3. 気になるアイデアを深掘りしたければ `search_x` で追加検索
4. 元ポストの文脈を知りたければ `search_x_user` でユーザーの他の投稿も確認

### 記事執筆前リサーチ

1. `x_context_research` で topic=記事テーマ, days=30 を実行
2. 返ってきた Context Pack を記事の骨子に活用
3. 不足している一次情報があれば `search_x` で補強

## 注意事項

- xAI API は従量課金（1回 ≈ $0.05–0.15）
- Grok の検索結果は「Grok が見つけた X 投稿」であり、完全な網羅性は保証されない
- 投資助言に見える表現は避ける（buy/sell推奨、価格目標など禁止）
- X 投稿の長文直接引用は避け、要旨 + URL で示す
