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

## トラブルシューティング

### サーバーが起動しない

- VSCodeを再起動してください
- 別のアプリケーションがポート4000を使用していないか確認してください
  ```bash
  lsof -i :4000
  ```

### モデル選択の問題

- VSCodeのLanguage Model APIへのアクセス権があることを確認してください
- インターネット接続を確認してください
- GitHub Copilot拡張機能がインストールされ、正しく設定されていることを確認してください

### ローカル開発時の問題

- TypeScriptコンパイルエラー
  ```bash
  npm run watch
  ```
  でエラーを確認し、必要な型定義ファイルがすべて揃っているか確認してください

- 拡張機能が読み込まれない場合
  1. VSCodeのコンソール（ヘルプ > 開発者ツールの切り替え）でエラーを確認
  2. `activationEvents` が正しく設定されているか確認
  3. `package.json` の依存関係が正しくインストールされているか確認

- 変更が反映されない場合
  1. `npm run compile` を実行して最新の変更をビルド
  2. VSCodeのリロード（開発者: ウィンドウのリロード）を実行

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