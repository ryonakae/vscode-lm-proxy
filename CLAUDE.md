# CLAUDE.md

このファイルは、このリポジトリのコードを扱う際にClaude Code（claude.ai/code）に指針を提供します。

## コマンド

```bash
# ビルド
npm run compile          # TypeScriptをコンパイル
npm run watch           # 監視モードでコンパイル

# リント
npm run check           # Biomeリンターを実行
biome check --write     # リントの問題を自動修正
```

## アーキテクチャ

このVS Code拡張機能は、VS CodeのLanguage Model APIをOpenAI/Anthropic互換のREST APIとして公開するプロキシサーバーを作成します。

主要コンポーネント:
- サーバー: ExpressベースのREST APIサーバー（/src/server）
- コンバーター: OpenAI/AnthropicとVS Code形式間の変換（/src/converter）
- モデル管理: VS Code言語モデルの選択を処理（/src/model）
- コマンドハンドラー: VS Codeコマンドの実装（/src/commands）
- UIコンポーネント: ステータスバーの統合（/src/ui）

APIエンドポイント:
- OpenAIチャット完了API（/openai/v1/chat/completions）
- AnthropicメッセージAPI（/anthropic/v1/messages）
- 両プロバイダーの完全なストリーミングサポート

技術要件:
- VS Code 1.93.0以上
- 仮想/信頼されていないワークスペースではサポートされていない
- ローカル環境が必要（リモートワークスペースのサポートなし）
