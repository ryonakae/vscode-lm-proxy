# LM Proxy

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

### マーケットプレイスからインストール
1. VSCode拡張機能マーケットプレイスからインストールする
2. または、`.vsix`ファイルをダウンロードし、「VSCODEから拡張機能をインストール」機能を使ってインストール

### ローカル開発版をテスト
ソースコードからローカルで拡張機能を試すには、以下の手順に従ってください：

1. リポジトリをクローン
   ```bash
   git clone https://github.com/user/vscode-lm-proxy.git
   cd vscode-lm-proxy
   ```

2. 依存関係のインストール
   ```bash
   npm install
   ```

3. 拡張機能をビルド
   ```bash
   npm run compile
   ```

4. デバッグモードで実行
   - VSCode内で`F5`キーを押す
   - または「実行とデバッグ」パネルから「Run Extension」を選択
   - 新しいVSCodeウィンドウが開き、拡張機能がデバッグモードで実行されます

## 使用方法

### 拡張機能の起動

1. コマンドパレットを開く（`Ctrl+Shift+P` または `Cmd+Shift+P`）
2. `LM Proxy: Select Language Model`を選択し、使用するモデルを選択
3. `LM Proxy: Start LM Proxy Server`を選択してサーバーを起動
4. ステータスバーにサーバーの状態が表示されます

### APIの使用

サーバーが起動したら、`http://localhost:4000/chat/completions`エンドポイントにOpenAI Chat Completions APIと同じ形式でリクエストを送信できます:

```bash
curl -X POST http://localhost:4000/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "vscode-lm-proxy",
    "messages": [
      {"role": "system", "content": "あなたは優秀なAIアシスタントです。"},
      {"role": "user", "content": "こんにちは！"}
    ]
  }'
```

> **注意**: `model`パラメーターには常に`"vscode-lm-proxy"`を指定してください。実際のモデル選択はVSCode内のコマンドパレットから行います。

ストリーミングモード：

```bash
curl -X POST http://localhost:4000/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "vscode-lm-proxy",
    "messages": [
      {"role": "system", "content": "あなたは優秀なAIアシスタントです。"},
      {"role": "user", "content": "こんにちは！"}
    ],
    "stream": true
  }' --no-buffer
```

## API リファレンス

このセクションではLM Proxyが提供するAPI機能について詳細に説明します。

### ベースURL

```
http://localhost:4000
```

> **注意**: ポート番号は設定で変更可能です。

### エンドポイント

#### GET /

サーバーのステータス情報を返します。

##### リクエスト

```bash
curl http://localhost:4000/
```

##### レスポンス

```json
{
  "status": "ok",
  "message": "VSCode LM API Proxy server is running",
  "version": "0.0.1",
  "endpoints": {
    "chat/completions": {
      "method": "POST",
      "description": "OpenAI互換のChat Completions API"
    }
  }
}
```

#### POST /chat/completions

チャット完了リクエストを送信します。OpenAI Chat Completions API互換のインターフェースです。

##### リクエストパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|---------|-------------|
| model | string | いいえ | 使用するモデルのID。指定しない場合は選択済みのモデルが使用されます |
| messages | array | はい | チャットメッセージの配列 |
| stream | boolean | いいえ | ストリーミングモードを有効にするか（デフォルト: false） |

##### メッセージフォーマット

| フィールド | 型 | 必須 | 説明 |
|-----------|------|---------|-------------|
| role | string | はい | メッセージの役割（"system", "user", "assistant"） |
| content | string | はい | メッセージの内容 |

##### レスポンス

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1686901302,
  "model": "モデルID",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "こんにちは！お手伝いできることがあればお知らせください。"
      },
      "index": 0,
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 0,
    "completion_tokens": 0,
    "total_tokens": 0
  }
}
```

##### ストリーミングモード

`stream: true`を指定すると、サーバーは次のような形式でストリーミングレスポンスを返します：

```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1686901302,"model":"モデルID","choices":[{"delta":{"role":"assistant","content":"こん"},"index":0,"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1686901302,"model":"モデルID","choices":[{"delta":{"content":"にちは！"},"index":0,"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1686901302,"model":"モデルID","choices":[{"delta":{"content":"お手伝いでき"},"index":0,"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1686901302,"model":"モデルID","choices":[{"delta":{"content":"ることがあれば"},"index":0,"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1686901302,"model":"モデルID","choices":[{"delta":{"content":"お知らせください。"},"index":0,"finish_reason":"stop"}]}

data: [DONE]
```

### エラーレスポンス

エラーが発生した場合、サーバーは適切なHTTPステータスコードと次のような形式のJSONレスポンスを返します：

```json
{
  "error": {
    "message": "エラーメッセージ",
    "type": "エラータイプ",
    "code": "エラーコード"
  }
}
```

#### 一般的なエラータイプ

- `invalid_request_error` - リクエストパラメータが無効な場合
- `token_limit_error` - トークン制限を超えた場合
- `rate_limit_error` - レート制限に達した場合
- `api_error` - APIの内部エラー
- `server_error` - サーバーの内部エラー

### 制限事項

- レート制限: 1分あたり10リクエスト
- トークン制限（モデルによる）:
  - gpt-4o: 128,000トークン
  - gpt-4o-mini: 32,000トークン
  - o1: 128,000トークン
  - o1-mini: 32,000トークン
  - claude-3.5-sonnet: 200,000トークン

## コマンド

- `LM Proxy: Start LM Proxy Server` - プロキシサーバーを起動します
- `LM Proxy: Stop LM Proxy Server` - 実行中のプロキシサーバーを停止します
- `LM Proxy: Select Language Model` - 使用する言語モデルを選択します

## キーボードショートカット

- サーバー起動: `Ctrl+Shift+L S`（Macでは`Cmd+Shift+L S`）
- サーバー停止: `Ctrl+Shift+L X`（Macでは`Cmd+Shift+L X`）
- モデル選択: `Ctrl+Shift+L M`（Macでは`Cmd+Shift+L M`）

## 制限事項

- トークン制限はモデルファミリーに基づく近似値です
- VSCode LM APIの制限に準拠します
- モデルの利用には適切な認証と同意が必要です

# トラブルシューティングガイド

このガイドでは、VSCode LM Proxy拡張機能を使用する際に発生する可能性がある一般的な問題とその解決策について説明します。

## インストールに関する問題

### 拡張機能をインストールできない

**症状**: 拡張機能のインストールが失敗する。

**解決策**:
1. VSCodeを最新バージョン（1.93.0以降）に更新しているか確認してください。
2. インターネット接続を確認してください。
3. VSCodeを再起動し、再度インストールを試してください。
4. VSCodeの開発者ツールコンソールを確認し、エラーメッセージの詳細を確認してください。

## サーバー関連の問題

### サーバーが起動しない

**症状**: 「サーバー起動エラー」というメッセージが表示される。

**解決策**:
1. VSCodeを再起動してください
2. 他のアプリケーションがポート4000を使用していないか確認してください。
   ```bash
   lsof -i :4000
   ```
3. 使用中の場合は、そのプロセスを終了するか、拡張機能の設定からポート番号を変更してください。
4. VSCodeを管理者権限で実行してみてください。

### サーバーが突然停止する

**症状**: サーバーが動作していたが、突然停止した。

**解決策**:
1. VSCodeの出力パネルでログを確認してください。
2. メモリ不足や他のシステムリソースの問題がないか確認してください。
3. 拡張機能を無効にして再度有効化してみてください。

## モデル選択の問題

### モデルが選択できない

**症状**: モデル選択コマンドを実行しても何も表示されない、またはエラーが表示される。

**解決策**:
1. VSCodeのLanguage Model APIへのアクセス権があることを確認してください
2. インターネット接続を確認してください
3. GitHub Copilot拡張機能がインストールされ、正しく設定されていることを確認してください
4. VSCodeを再起動してみてください。

### 選択したモデルが記憶されない

**症状**: モデルを選択しても、拡張機能を再起動するとリセットされる。

**解決策**:
1. VSCodeのワークスペースまたはユーザー設定が書き込み可能であることを確認してください。
2. 拡張機能を無効にして再度有効化してみてください。

## API使用時の問題

### リクエストがタイムアウトする

**症状**: APIリクエストが長時間応答を返さずにタイムアウトする。

**解決策**:
1. ネットワーク接続を確認してください。
2. リクエストが複雑すぎないか確認してください。
3. サーバーが実行中であることを確認してください。
4. VSCodeのメモリ使用量が高すぎないか確認してください。

### トークン制限エラーが発生する

**症状**: 「トークン制限超過」というエラーが返される。

**解決策**:
1. リクエストのメッセージを短くしてください。
2. 複数の小さなリクエストに分割してください。
3. より大きなコンテキストウィンドウを持つモデルに切り替えてください。

### レート制限エラーが発生する

**症状**: 「レート制限に達しました」というエラーが返される。

**解決策**:
1. リクエストの頻度を下げてください（デフォルトは1分あたり10リクエスト）。
2. しばらく待ってから再試行してください。
3. 複数のリクエストを1つにまとめることを検討してください。

## その他の問題

### ステータスバーの表示が更新されない

**症状**: サーバーの状態が変わってもステータスバーが更新されない。

**解決策**:
1. コマンドパレットから「リロードウィンドウ」を実行してVSCodeを再読み込みしてください。
2. 拡張機能を無効にして再度有効化してみてください。

### キーバインディングが機能しない

**症状**: 設定されたキーバインディングでコマンドが実行されない。

**解決策**:
1. キーボードショートカットの設定で、キーバインディングが他のコマンドと競合していないか確認してください。
2. VSCodeの「キーボードショートカット」設定で、バインディングを手動で再設定してみてください。

## ローカル開発時の問題

### TypeScriptコンパイルエラー

**症状**: ビルド時にTypescriptエラーが発生する。

**解決策**:
```bash
npm run watch
```
でエラーを確認し、必要な型定義ファイルがすべて揃っているか確認してください

### 拡張機能が読み込まれない場合

**症状**: 拡張機能が有効にならない。

**解決策**:
1. VSCodeのコンソール（ヘルプ > 開発者ツールの切り替え）でエラーを確認
2. `activationEvents` が正しく設定されているか確認
3. `package.json` の依存関係が正しくインストールされているか確認

### 変更が反映されない場合

**症状**: コード変更後も動作が変わらない。

**解決策**:
1. `npm run compile` を実行して最新の変更をビルド
2. VSCodeのリロード（開発者: ウィンドウのリロード）を実行

## 問題が解決しない場合

上記の対処法で問題が解決しない場合は、以下の情報を含むIssueを作成してください：

1. VSCodeのバージョン
2. 拡張機能のバージョン
3. オペレーティングシステムの情報
4. 詳細なエラーメッセージとスタックトレース（可能な場合）
5. 問題を再現する手順

また、VSCodeの開発者ツール（ヘルプ > 開発者ツールの切り替え）を開いてコンソールログを確認すると、より詳細な診断情報が得られる場合があります。

## Marketplace公開情報

### Microsoft AIガイドラインへの準拠

この拡張機能は、以下のMicrosoft AIガイドラインに準拠しています：

- [Microsoft AI tools and practices guidelines](https://learn.microsoft.com/en-us/legal/cognitive-services/openai/transparency-note)
- [GitHub Copilot extensibility acceptable development policy](https://docs.github.com/en/copilot/overview-of-github-copilot/about-github-copilot-extensibility)

この拡張機能は以下の要件を満たしています：

1. **透明性**: ユーザーに対して、この拡張機能がAIモデルを使用していることを明示しています
2. **同意**: モデルの利用前にユーザーの明示的な同意を得ています
3. **セキュリティ**: すべてのデータ処理はローカルで行われ、外部にデータを送信しません
4. **パフォーマンス**: モデル選択とレート制限によりパフォーマンスを最適化しています
5. **アクセシビリティ**: すべての機能にキーボードショートカットを提供しています

### プライバシーとデータ収集

この拡張機能は、以下のプライバシーポリシーに従って動作します：

- ユーザーデータは外部に送信されません
- すべての処理はローカルVSCodeインスタンス内で行われます
- 統計情報や使用状況データは収集しません
- サーバー機能はlocalhost内でのみ動作します

### 必要な権限

この拡張機能は、以下のVSCode APIにアクセスします：

- `vscode.lm`: Language Model APIへのアクセス
- ネットワーク機能: localhost上でのHTTP APIサーバーの実行

モデル使用時にはVSCodeの標準認証フローを通じてユーザーの同意を取得します。

## Marketplace公開チェックリスト

この拡張機能をMarketplaceに公開する前に、以下の項目を確認してください：

1. **拡張機能マニフェスト**
   - [x] `package.json`のすべての必須フィールドが適切に設定されている
   - [x] アイコン、バナー、カテゴリなどが設定されている
   - [x] ライセンス情報が正確に記載されている

2. **ドキュメント**
   - [x] README.mdが完全で、使用方法が明確に説明されている
   - [x] スクリーンショットまたはアニメーション付きのデモが含まれている
   - [x] トラブルシューティング情報が提供されている

3. **コードの品質**
   - [x] すべてのリンター警告が解決されている
   - [x] テストスイートが実装され、すべてのテストがパスしている
   - [x] エラー処理が適切に実装されている

4. **Microsoft AIガイドライン**
   - [x] Microsoft AI tools and practices guidelinesに準拠している
   - [x] GitHub Copilot extensibility acceptable development policyに準拠している
   - [x] 必要なプライバシー情報とデータ使用の説明が提供されている

5. **依存関係の最適化**
   - [x] 依存関係が最小限に保たれている（Express.jsのみ使用）
   - [x] クライアントサイドのオープンソースライブラリのみを使用している
   - [x] パフォーマンスに影響を与える可能性のある巨大な依存関係は排除している

## ライセンス

MIT