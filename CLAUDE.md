# まいちゃんスタンプカード - プロジェクトメモ

## 構成
- フロントエンド: Vite + Vanilla JS
- バックエンド: Firebase Firestore (リアルタイム監視)
- デプロイ: Cloudflare Workers (静的アセット配信)

## Firebase プロジェクト
- プロジェクト名: `mai-stamp-card`
- Firestore コレクション: `stampCards` / ドキュメント: `card1`

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

## トラブルシューティング履歴
- `.npmrc` に `legacy-peer-deps=true` が必要（依存関係の競合対策）
- `vite.config.js` に `plugins: []` が必要（Cloudflare Wrangler の要件）
- `.node-version` に `20` が必要（Vite 5 は Node.js 18+ が必要）
- `wrangler.toml` が必要（ないと Wrangler が自動設定を試みて `@cloudflare/vite-plugin` を vite.config.js に追加してしまい、パッケージ未インストールでビルド失敗する）
