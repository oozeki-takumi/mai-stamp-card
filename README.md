# まいちゃんスタンプカード

Firebase (Firestore) + Vite で作ったスタンプカード Web アプリ。

---

## セットアップ手順

### 1. Firebase の設定値を記入

`src/firebase-config.js` を開き、Firebase Console のプロジェクト設定から取得した値を貼り付ける。

```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  ...
}
```

### 2. Firestore のルールを設定

Firebase Console > Firestore Database > ルール で以下を設定：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 読み取りは誰でも OK、書き込みは認証ユーザーのみ（管理者向け）
    match /stampCards/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

> ※ 管理者ボタンで書き込む場合は Firebase Authentication も設定が必要です。
> 　 テスト中は一時的に `allow write: if true;` にしてもOKですが本番前に必ず変更してください。

### 3. 依存関係のインストール

```bash
npm install
```

### 4. ローカル開発

```bash
npm run dev
```

ブラウザで http://localhost:5173 を開く。

---

## Cloudflare Pages へのデプロイ

1. GitHub にリポジトリを push する
2. Cloudflare Pages でプロジェクトを新規作成
3. ビルド設定：
   - **フレームワーク**: Vite
   - **ビルドコマンド**: `npm run build`
   - **出力ディレクトリ**: `dist`
4. 「保存してデプロイ」をクリック

---

## 管理者モード

URL の末尾に `?admin=1` を付けると「スタンプを押す」「リセット」ボタンが表示される。

例: `https://your-site.pages.dev/?admin=1`

---

## ファイル構成

```
まいちゃんスタンプカード/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── firebase-config.js  ← Firebase 設定値を記入
    ├── main.js             ← ロジック・Firestore 連携
    └── style.css           ← スタイル
```
