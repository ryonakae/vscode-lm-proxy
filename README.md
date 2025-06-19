# VSCode LiteLLM

VSCode Language Model APIをOpenAI互換のREST APIとして公開する拡張機能です。
この拡張機能を使用すると、VSCodeのLanguage Model APIを外部アプリケーションから簡単に利用できます。

## 機能

- VSCodeのLM APIをOpenAI互換のREST APIとして公開
- 複数のモデルファミリーに対応 (gpt-4o, gpt-4o-mini, o1, o1-mini, claude-3.5-sonnet)
- ステータスバーからのサーバー管理
- サーバーの起動/停止/モデル選択のためのコマンドパレットコマンド
- ストリーミングレスポンス対応
- トークン制限とレート制限の管理
- エラーハンドリング

## インストール

1. VSCode拡張機能マーケットプレイスからインストールする
2. または、`.vsix`ファイルをダウンロードし、「VSCODEから拡張機能をインストール」機能を使ってインストール

## 使用方法

### 拡張機能の起動

1. コマンドパレットを開く（`Ctrl+Shift+P` または `Cmd+Shift+P`）
2. `VSCode LiteLLM: Select Language Model`を選択し、使用するモデルを選択
3. `VSCode LiteLLM: Start LM Proxy Server`を選択してサーバーを起動
4. ステータスバーにサーバーの状態が表示されます

### APIの使用

サーバーが起動したら、`http://localhost:4000/chat/completions`エンドポイントにOpenAI Chat Completions APIと同じ形式でリクエストを送信できます:

```bash
curl -X POST http://localhost:4000/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "モデルID",
    "messages": [
      {"role": "system", "content": "あなたは優秀なAIアシスタントです。"},
      {"role": "user", "content": "こんにちは！"}
    ]
  }'
```

ストリーミングモード：

```bash
curl -X POST http://localhost:4000/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "モデルID",
    "messages": [
      {"role": "system", "content": "あなたは優秀なAIアシスタントです。"},
      {"role": "user", "content": "こんにちは！"}
    ],
    "stream": true
  }' --no-buffer
```

## コマンド

- `VSCode LiteLLM: Start LM Proxy Server` - プロキシサーバーを起動します
- `VSCode LiteLLM: Stop LM Proxy Server` - 実行中のプロキシサーバーを停止します
- `VSCode LiteLLM: Select Language Model` - 使用する言語モデルを選択します

## キーボードショートカット

- サーバー起動: `Ctrl+Shift+L S`（Macでは`Cmd+Shift+L S`）
- サーバー停止: `Ctrl+Shift+L X`（Macでは`Cmd+Shift+L X`）
- モデル選択: `Ctrl+Shift+L M`（Macでは`Cmd+Shift+L M`）

## 制限事項

- トークン制限はモデルファミリーに基づく近似値です
- VSCode LM APIの制限に準拠します
- モデルの利用には適切な認証と同意が必要です

## トラブルシューティング

### サーバーが起動しない

- VSCodeを再起動してください
- 別のアプリケーションがポート4000を使用していないか確認してください

### モデル選択の問題

- VSCodeのLanguage Model APIへのアクセス権があることを確認してください
- インターネット接続を確認してください

## ライセンス

MIT