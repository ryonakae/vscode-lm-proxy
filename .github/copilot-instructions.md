# VSCode LM Proxy プロジェクトのコーディング規約と開発ガイドライン

## 技術スタック (Tech Stack)

- TypeScript 5.8.2
- VSCode API 1.93.0
- Express 4.18.3
- Node.js
- ESLint + TypeScript ESLint

## プロジェクトの概要

VSCode LM Proxy は VSCode の Language Model API を OpenAI 互換の REST API として公開する拡張機能です。
これにより外部アプリケーションから VSCode の Language Model API を簡単に利用できるようになります。

## コーディング規約 (Coding Conventions)

- **TypeScript**: 厳格な型付けを使用し、`any`型の使用を避ける（必要な場合は明示的な理由をコメントで記載）
- **クラス設計**: シングルトンパターンを活用し、適切なマネージャークラスで機能を分離する
- **非同期処理**: async/await を使用し、Promise チェーンは避ける
- **エラーハンドリング**: try/catch を適切に使用し、エラーログを詳細に残す
- **命名規則**:
  - クラス: PascalCase (例: `ModelManager`, `LimitsManager`)
  - 関数・メソッド: camelCase
  - 定数: UPPER_SNAKE_CASE または readonly プロパティ
  - ファイル名: camelCase (例: `extension.ts`, `manager.ts`)
  - プライベートメンバー: `_` プレフィックス または private キーワード

## フォーマット規則 (Formatting Rules)

- **インデント**: スペース 2 つ
- **引用符**: シングルクォート (`'`)
- **セミコロン**: 必須
- **末尾カンマ**: マルチライン要素では必須
- **コメント**: 公開 API には JSDoc スタイルのコメントを使用

## プロジェクト構造 (Project Structure)

- **src/extension.ts**: 拡張機能のエントリーポイント
- **src/commands/**: コマンド定義と実装
- **src/model/**: Language Model API 関連の処理
- **src/server/**: Express サーバーと API エンドポイント
- **src/ui/**: ステータスバーなどの UI コンポーネント
- **src/utils/**: ユーティリティ関数やクラス
- **src/test/**: テストコード

## モジュール設計 (Module Design)

- **機能の分離**: 各モジュールは単一の責任を持つようにする
- **依存性の明示**: import ステートメントは明示的に記述
- **循環参照の回避**: モジュール間の依存関係を単方向に保つ
- **グローバル状態**: 最小限に抑え、適切なマネージャーに集約する

## エラーハンドリングとログ (Error Handling and Logging)

- **ログレベル**: DEBUG、INFO、WARN、ERRORの適切なレベルを使い分ける
- **ユーザーエラー**: ユーザーに表示するエラーは分かりやすいメッセージを用意
- **内部エラー**: スタックトレースを含む詳細なログを残す
- **API エラー**: OpenAI 互換の形式でエラーレスポンスを返す

## サーバー実装 (Server Implementation)

- **エンドポイント**: RESTful API の原則に従う
- **リクエスト検証**: 入力値の検証を徹底する
- **レスポンスフォーマット**: OpenAI API 互換のフォーマットを維持
- **ストリーミング**: SSE (Server-Sent Events) に準拠した実装

## モデル管理 (Model Management)

- **モデル選択**: ユーザーが選択したモデル情報を永続化
- **トークン制限**: モデルごとの適切なトークン制限を実装
- **レート制限**: API 使用量制限を実装

## VSCode API の利用 (VSCode API Usage)

- **拡張機能 API**: 公式ドキュメントに従った適切な API 使用
- **コマンド登録**: `vscode.commands.registerCommand` で適切に登録
- **ステータスバー**: `vscode.window.createStatusBarItem` で作成

## パフォーマンス最適化 (Performance Optimization)

- **メモリ使用量**: 大きなデータ構造や無限にキャッシュされるデータは避ける
- **非同期処理**: UI スレッドをブロックしない実装
- **リソース解放**: 拡張機能の無効化時に適切にリソースを解放する

## コードレビュー基準 (Code Review Criteria)

- **型安全性**: 適切な型定義がされているか
- **エラーハンドリング**: 例外処理が適切か
- **テスト**: 重要な機能のテストが追加されているか
- **ドキュメント**: 公開 API や複雑なロジックにコメントがあるか
- **パフォーマンス**: 効率的な実装になっているか

## テスト (Testing)

- **ユニットテスト**: モデル変換、制限管理などの重要なロジック
- **統合テスト**: サーバーとモデル API の連携
- **コマンドテスト**: UI コマンドの動作確認
- **モック**: VSCode API や外部依存をモック化してテスト

## セキュリティ考慮事項 (Security Considerations)

- **ローカル通信のみ**: サーバーは localhost でのみ動作
- **認証**: 必要に応じて API キー認証を実装
- **データ保護**: ユーザーデータを外部に送信しない
- **依存関係**: 定期的に依存パッケージの脆弱性をチェック

## デバッグとトラブルシューティング (Debugging and Troubleshooting)

- **ログ出力**: 問題の診断に役立つ詳細なログを出力
- **エラーコード**: 明確なエラーコードと説明を提供
- **ユーザーサポート**: README にトラブルシューティングガイドを含める
