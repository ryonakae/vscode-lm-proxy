# VSCode LM Proxy プロジェクトのコーディング規約と開発ガイドライン

## 技術スタック (Tech Stack)

- TypeScript 5.8.2
- VSCode API 1.93.0
- Express 4.18.3
- Node.js
- Biome 2.0.5 (リンターとフォーマッター)

## プロジェクトの概要

VSCode LM Proxy は VSCode の Language Model API を OpenAI/Anthropic 互換の REST API として公開する拡張機能です。
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
- **Biome**: フォーマットとリントには Biome を使用（`biome check`, `biome check --write`）

## プロジェクト構造 (Project Structure)

- **src/extension.ts**: 拡張機能のエントリーポイント
- **src/commands/**: コマンド定義と実装（startServer, stopServer, selectOpenAIModel など）
- **src/model/**: Language Model API 関連の処理
- **src/server/**: Express サーバーと API エンドポイント（OpenAI API と Anthropic API）
- **src/converter/**: OpenAI/Anthropic と VSCode 形式間の変換処理
- **src/ui/**: ステータスバーなどの UI コンポーネント
- **src/utils/**: ユーティリティ関数やロギング機能

## モジュール設計 (Module Design)

- **機能の分離**: 各モジュールは単一の責任を持つようにする
- **依存性の明示**: import ステートメントは明示的に記述
- **循環参照の回避**: モジュール間の依存関係を単方向に保つ
- **グローバル状態**: 最小限に抑え、適切なマネージャーに集約する

## エラーハンドリングとログ (Error Handling and Logging)

- **ログレベル**: DEBUG(0)、INFO(1)、WARN(2)、ERROR(3)の適切なレベルを使い分ける
- **ユーザーエラー**: ユーザーに表示するエラーは分かりやすいメッセージを用意
- **内部エラー**: スタックトレースを含む詳細なログを残す
- **API エラー**: OpenAI/Anthropic 互換の形式でエラーレスポンスを返す

## サーバー実装 (Server Implementation)

- **エンドポイント**: RESTful API の原則に従う
- **リクエスト検証**: 入力値の検証を徹底する
- **レスポンスフォーマット**: OpenAI/Anthropic API 互換のフォーマットを維持
- **ストリーミング**: SSE (Server-Sent Events) に準拠した実装
- **ポート設定**: デフォルトは4000、設定で変更可能（1024〜65535の範囲）

## モデル管理 (Model Management)

- **モデル選択**: ユーザーが選択したモデル情報を永続化
- **トークン制限**: モデルごとの適切なトークン制限を実装
- **レート制限**: API 使用量制限を実装
- **OpenAI互換モデル**: OpenAI API の仕様に合わせたモデル名を提供

## VSCode API の利用 (VSCode API Usage)

- **拡張機能 API**: 公式ドキュメントに従った適切な API 使用
- **コマンド登録**: `vscode.commands.registerCommand` で適切に登録
- **ステータスバー**: `vscode.window.createStatusBarItem` で作成
- **ショートカットキー**: 主要な機能にはキーボードショートカットを提供（Cmd+Shift+L など）
- **出力パネル**: ログ表示のために専用の出力チャンネルを使用

## パフォーマンス最適化 (Performance Optimization)

- **メモリ使用量**: 大きなデータ構造や無限にキャッシュされるデータは避ける
- **非同期処理**: UI スレッドをブロックしない実装
- **リソース解放**: 拡張機能の無効化時に適切にリソースを解放する

## コードレビュー基準 (Code Review Criteria)

- **型安全性**: 適切な型定義がされているか
- **エラーハンドリング**: 例外処理が適切か
- **ドキュメント**: 公開 API や複雑なロジックにコメントがあるか
- **パフォーマンス**: 効率的な実装になっているか
- **Biome準拠**: Biomeのルールに従っているか

## セキュリティ考慮事項 (Security Considerations)

- **ローカル通信のみ**: サーバーは localhost でのみ動作
- **認証**: 必要に応じて API キー認証を実装
- **データ保護**: ユーザーデータを外部に送信しない
- **依存関係**: 定期的に依存パッケージの脆弱性をチェック
- **信頼性**: 仮想/信頼されていないワークスペースでは動作しない

## デバッグとトラブルシューティング (Debugging and Troubleshooting)

- **ログ出力**: 問題の診断に役立つ詳細なログを出力（setDebugLogLevel, setInfoLogLevel コマンドで切り替え可能）
- **エラーコード**: 明確なエラーコードと説明を提供
- **ユーザーサポート**: README にトラブルシューティングガイドを含める
- **出力パネル**: showOutput, clearOutput コマンドでログの確認・クリアが可能

## 拡張機能の要件と制限

- **VSCode バージョン**: 1.93.0 以上が必要
- **ワークスペース制限**: 仮想ワークスペース、信頼されていないワークスペースでは動作しない
- **実行環境**: ローカル環境のみでの動作を想定（リモートワークスペースでは使用不可）
- **拡張機能の種類**: UI拡張機能として動作
