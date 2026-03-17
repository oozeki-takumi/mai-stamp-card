# まいちゃんスタンプカード - プロジェクトメモ

## 構成
- フロントエンド: Vite + Vanilla JS
- バックエンド: Firebase Firestore (リアルタイム監視)
- デプロイ: Cloudflare Pages

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

## Cloudflare Pages ビルド設定
- ビルドコマンド: `npm run build`
- 出力ディレクトリ: `dist`

## トラブルシューティング履歴
- `.npmrc` に `legacy-peer-deps=true` が必要（依存関係の競合対策）
- `vite.config.js` に `plugins: []` が必要（Cloudflare Wrangler の要件）
