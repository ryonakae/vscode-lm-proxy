# VSCode LM Proxy 開発ガイド

このファイルは、VSCode LM Proxyプロジェクトのコードを扱う際にClaude Code（claude.ai/code）やその他のAIアシスタントに開発指針を提供します。

## プロジェクト概要

VSCode LM Proxy は VSCode の Language Model API を OpenAI/Anthropic 互換の REST API として公開する拡張機能です。
これにより外部アプリケーションから VSCode の Language Model API を簡単に利用できるようになります。

## 技術スタック

- **TypeScript**: 5.8.3（厳格な型付け）
- **VSCode API**: 1.101.0以上
- **Express**: 4.21.2（REST APIサーバー）
- **Node.js**: 20.x
- **Biome**: 2.0.5（リンターとフォーマッター）

## 開発コマンド

```bash
# 開発
npm run compile          # TypeScriptをコンパイル
npm run watch           # 監視モードでコンパイル

# コード品質
npm run check           # Biomeリンターを実行
biome check --write     # リントの問題を自動修正

# パッケージング
npm run vscode:prepublish  # 拡張機能のビルド（公開前）
```

## プロジェクト構造

```
src/
├── extension.ts              # 拡張機能エントリーポイント
├── commands/                 # VSCodeコマンド実装
│   ├── index.ts             # コマンド一括登録
│   ├── model.ts             # モデル選択コマンド
│   ├── output.ts            # 出力パネルコマンド
│   └── server.ts            # サーバー制御コマンド
├── converter/               # API形式変換
│   ├── anthropicConverter.ts # Anthropic API変換
│   └── openaiConverter.ts   # OpenAI API変換
├── model/                   # モデル管理
│   └── manager.ts           # モデル選択・管理
├── server/                  # REST APIサーバー
│   ├── server.ts            # Expressサーバー設定
│   ├── manager.ts           # サーバー起動・停止
│   ├── handler.ts           # 共通ハンドラー
│   ├── openaiHandler.ts     # OpenAI API互換エンドポイント
│   ├── anthropicHandler.ts  # Anthropic API互換エンドポイント
│   └── claudeCodeHandler.ts # Claude Code互換エンドポイント
├── ui/                      # UIコンポーネント
│   └── statusbar.ts         # ステータスバー管理
└── utils/                   # ユーティリティ
    ├── index.ts             # ユーティリティ関数
    └── logger.ts            # ログ機能
```

## 主要機能とアーキテクチャ

### 1. REST APIサーバー
ExpressベースのサーバーがローカルホストでVSCode Language Model APIをプロキシします：

**APIエンドポイント：**
- OpenAI Chat Completions: `/openai/v1/chat/completions`
- Anthropic Messages: `/anthropic/v1/messages`
- Claude Code Messages: `/anthropic/claude/v1/messages`
- モデル一覧: `/openai/v1/models`, `/anthropic/v1/models`
- トークンカウント: `/anthropic/v1/messages/count_tokens`

### 2. モデル管理
VSCodeで利用可能な言語モデルを管理し、OpenAI/Anthropic形式のモデル名にマッピングします：
- GitHub Copilot models
- Claude models (if available)
- 動的なモデル選択と永続化

### 3. リクエスト変換
OpenAI/Anthropic形式のリクエストをVSCode Language Model API形式に変換：
- メッセージ形式の変換
- パラメータのマッピング
- ストリーミングレスポンスの処理

### 4. UIコンポーネント
VSCodeステータスバーでサーバー状態とモデル選択を管理：
- サーバー起動/停止の制御
- 現在選択中のモデル表示
- 簡単なモデル切り替え

## コーディング規約

### TypeScript
- 厳格な型付けを使用、`any`型は避ける
- 必要な場合は明示的な理由をコメントで記載
- async/await を使用、Promise チェーンは避ける

### 命名規則
- **クラス**: PascalCase (`ModelManager`, `ServerManager`)
- **関数・メソッド**: camelCase
- **定数**: UPPER_SNAKE_CASE または readonly プロパティ
- **ファイル名**: camelCase (`extension.ts`, `manager.ts`)
- **プライベートメンバー**: `_` プレフィックス または private キーワード

### フォーマット規則
- **インデント**: スペース 2 つ
- **引用符**: シングルクォート (`'`)
- **セミコロン**: 必須
- **末尾カンマ**: マルチライン要素では必須

### エラーハンドリング
- try/catch を適切に使用
- エラーログを詳細に残す
- **ログレベル**: DEBUG(0)、INFO(1)、WARN(2)、ERROR(3)の適切なレベルを使い分ける
- OpenAI/Anthropic 互換の形式でエラーレスポンスを返す

## 設定とコマンド

### 拡張機能設定
- `vscode-lm-proxy.port`: サーバーポート（デフォルト: 4000）
- `vscode-lm-proxy.logLevel`: ログレベル（0-3）
- `vscode-lm-proxy.showOutputOnStartup`: 起動時の出力パネル表示

### VSCodeコマンド
- `vscode-lm-proxy.startServer`: サーバー起動
- `vscode-lm-proxy.stopServer`: サーバー停止
- `vscode-lm-proxy.selectOpenAIModel`: OpenAIモデル選択
- `vscode-lm-proxy.selectAnthropicModel`: Anthropicモデル選択
- `vscode-lm-proxy.selectClaudeCodeBackgroundModel`: Claude Codeバックグラウンドモデル選択
- `vscode-lm-proxy.selectClaudeCodeThinkingModel`: Claude Code思考モデル選択
- `vscode-lm-proxy.showOutput`: 出力パネル表示
- `vscode-lm-proxy.clearOutput`: 出力パネルクリア
- `vscode-lm-proxy.setLogLevel`: ログレベル設定

## パフォーマンスとセキュリティ

### パフォーマンス最適化
- メモリ使用量を最小限に抑える
- 非同期処理でUIスレッドをブロックしない
- 拡張機能無効化時に適切にリソースを解放

### セキュリティ考慮事項
- **ローカル通信のみ**: サーバーは localhost でのみ動作
- **データ保護**: ユーザーデータを外部に送信しない
- **依存関係**: 定期的に依存パッケージの脆弱性をチェック

## 開発時の注意点

### 既存コード参考
- 既存コードの設計や記法を参考にする
- シングルトンパターンを活用したマネージャークラス設計
- 適切な機能分離とモジュール設計

### コメント規則
- 公開 API には JSDoc スタイルのコメント
- コードから自明な処理の説明コメントは避ける
- 複雑なアルゴリズム、ビジネスロジック、設計トレードオフの「なぜ（Why）」を説明

### エラー修正
- lint・typecheckでは、Errorのみ修正対象
- Warning・Infoは修正しない

## 拡張機能の制約

### 技術要件
- **VSCode バージョン**: 1.101.0 以上が必要
- **ワークスペース制限**: 仮想ワークスペース、信頼されていないワークスペースでは動作しない
- **実行環境**: ローカル環境のみでの動作（リモートワークスペースでは使用不可）
- **拡張機能の種類**: UI拡張機能として動作

### API制限
- VSCode Language Model APIの利用制限に準拠
- トークン制限とレート制限を実装
- 適切なエラーハンドリングと制限情報の提供

## デバッグとトラブルシューティング

### ログ機能
- 詳細なログ出力で問題の診断をサポート
- コマンドでログレベルの動的変更が可能
- 出力パネルでのログ確認・クリア機能

### エラー対応
- 明確なエラーコードと説明を提供
- ユーザーに分かりやすいエラーメッセージ
- 内部エラーは詳細なスタックトレースを記録
