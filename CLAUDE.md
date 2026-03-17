# まいちゃんスタンプカード - プロジェクトメモ

## 構成
- フロントエンド: Vite + Vanilla JS
- バックエンド: Firebase Firestore (リアルタイム監視)
- デプロイ: Cloudflare Workers (静的アセット配信 + AIプロキシ)
- AI: Anthropic Claude API (claude-haiku-4-5-20251001) / APIキーは Cloudflare Workers の secret に保存

## Firebase プロジェクト
- プロジェクト名: `mai-stamp-card`
- Firestore コレクション・ドキュメント構造:
  - `stampCards/home_card`: `{ stamps: [false, false, false] }`
  - `stampCards/together_card`: `{ stamps: [false, false, false] }`
  - `stampRequests/{id}`: `{ cardId, stampIndex, requestedAt }`
  - `hamster/data`: `{ coins, hunger(0-24), seedSmall, seedMedium, seedLarge, lastHungerUpdate(ms timestamp), sleeping, sleepUntil(ms), nextSleepAt(ms), grumpyUntil(ms) }`

## GitHub リポジトリ
- `https://github.com/oozeki-takumi/mai-stamp-card`

## 開発サーバー起動
```bash
npm run dev
# → http://localhost:5173
# 管理者モード: http://localhost:5173/?admin=1
```

## デプロイ先
- URL: `https://mai-stamp-card.oozeki-takumi.workers.dev`
- 管理者URL: `https://mai-stamp-card.oozeki-takumi.workers.dev/?admin=1`
- `main` ブランチへの push で自動デプロイ

## Cloudflare Workers ビルド設定
- ビルドコマンド: `npm run build`
- デプロイコマンド: `npx wrangler deploy`
- 出力ディレクトリ: `dist`
- 設定ファイル: `wrangler.toml`

## 管理者モード
- 通常URL: 閲覧のみ（まいちゃんに見せる用）
- `?admin=1` 付きURL: スタンプ追加・リセットボタンが表示される

## 現在の機能
### スタンプカード
- 2種類のカード（おうちスタンプ / 一緒スタンプ）をタブ切り替え
- 各カードにラベル付きスタンプ3つ
- まいちゃんが「お願いする」ボタンでリクエスト送信
- 管理者側に通知が届き「スタンプを押す」で承認
- 3つ全部貯まると「提出する」ボタンが出現 → 押すとリセット + 1000コイン獲得

### ハムスターペットゲーム
- ハムスターがアリーナ内を左右に歩き回り上下バウンス
- 空腹度に応じてセリフが変わる（7秒ごとに自動発話）
- BGM: `public/BGM.mp3` をループ再生（初回タップ/クリック時に開始）
- **空腹システム（☆24段階）**:
  - 1時間ごとに☆1減少（`lastHungerUpdate`タイムスタンプで計算）
  - ☆24 → `hamster.gokigen.png`、☆23〜11 → `hamster.png`、☆10〜1 → `hamster.hukigen.png`、☆0 → `hamster_kuufuku.png`（会話不可）
  - ☆10以下で不機嫌・餌要求セリフ
- **睡眠システム**: 1〜6時間ごとにランダムで30〜120分眠る
  - 寝てる間は `hamster_bed.png`、話しかけると起こせるが5分間不機嫌（`grumpyUntil`）
- **ひまわりショップ** (🌻 ショップボタン → モーダル):
  - 🌱 種（小）100コイン → ☆+8、🌿 種（中）200コイン → ☆+15、🌻 種（大）300コイン → ☆+24
- **アイテム欄**: 購入した種の在庫表示・「あげる」ボタンで使用
- レベルシステム廃止（exp/level 削除）
- 管理者パネルに「💰 1000コイン追加」ボタン
- ハムスター画像: `public/hamster.png`（ピクセルアート）
- アリーナ背景: `public/hamu_room.png`
- ハムスターの性格: 関西弁をしゃべる気さくなおじさん
- **AIチャット機能**: テキスト入力欄からハムスターに話しかけるとClaude AIが返答
  - エンドポイント: `POST /api/chat` (worker.js で処理)
  - 空腹度(☆0-24)・コイン・isGrumpy の状態をAIに渡してキャラクター性のある返答を生成
  - APIキー管理: `npx wrangler secret put ANTHROPIC_API_KEY` で設定

### スタンプラベル（CARDS定義 src/main.js）
- おうちスタンプ: nanaで配信した / nanaのフォロワーを10人増やした / 障碍年金のお話を進めた
- 一緒スタンプ: お部屋のお掃除をした / たたにマッサージをした / なんでもいいよ

## Cloudflare Workers スクリプト (worker.js)
- `main = "worker.js"` を wrangler.toml に追加することで静的アセット配信 + APIエンドポイントを両立
- `/api/chat` POST: Anthropic API へのプロキシ（CORS対応）
- それ以外のリクエスト: `env.ASSETS.fetch(request)` で静的ファイルを返す

## トラブルシューティング履歴
- `.npmrc` に `legacy-peer-deps=true` が必要（依存関係の競合対策）
- `vite.config.js` に `plugins: []` が必要（Cloudflare Wrangler の要件）
- `.node-version` に `20` が必要（Vite 5 は Node.js 18+ が必要）
- `wrangler.toml` が必要（ないと Wrangler が自動設定を試みて `@cloudflare/vite-plugin` を vite.config.js に追加してしまい、パッケージ未インストールでビルド失敗する）
