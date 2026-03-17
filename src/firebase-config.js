// ===================================================
// Firebase の設定値をここに貼り付けてください
// Firebase Console > プロジェクト設定 > マイアプリ > SDK の設定と構成
// ===================================================
export const firebaseConfig = {
  apiKey: "AIzaSyDqCxRox5zpQKPe5Z6F4wZA24YC1C2nM0",
  authDomain: "mai-stamp-card.firebaseapp.com",
  projectId: "mai-stamp-card",
  storageBucket: "mai-stamp-card.firebasestorage.app",
  messagingSenderId: "331348491231",
  appId: "1:331348491231:web:71a4c75bf3faccb361a26a",
  measurementId: "G-LZ1JSZ0B3H",
}

// Firestore のコレクション名・ドキュメント名
export const COLLECTION = "stampCards"
export const DOCUMENT_ID = "card1"  // カードのIDを変えれば複数のカードを管理できる
