# VSCode LiteLLM API リファレンス

このドキュメントではVSCode LiteLLMが提供するAPI機能について説明します。

## ベースURL

```
http://localhost:4000
```

## エンドポイント

### GET /

サーバーのステータス情報を返します。

#### リクエスト

```bash
curl http://localhost:4000/
```

#### レスポンス

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

### POST /chat/completions

チャット完了リクエストを送信します。OpenAI Chat Completions API互換のインターフェースです。

#### リクエスト

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

#### リクエストパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|---------|-------------|
| model | string | いいえ | 使用するモデルのID。指定しない場合は選択済みのモデルが使用されます |
| messages | array | はい | チャットメッセージの配列 |
| stream | boolean | いいえ | ストリーミングモードを有効にするか（デフォルト: false） |

#### メッセージフォーマット

| フィールド | 型 | 必須 | 説明 |
|-----------|------|---------|-------------|
| role | string | はい | メッセージの役割（"system", "user", "assistant"） |
| content | string | はい | メッセージの内容 |

#### レスポンス

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

#### ストリーミングモード

`stream: true`を指定すると、サーバーは次のような形式でストリーミングレスポンスを返します：

```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1686901302,"model":"モデルID","choices":[{"delta":{"role":"assistant","content":"こん"},"index":0,"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1686901302,"model":"モデルID","choices":[{"delta":{"content":"にちは！"},"index":0,"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1686901302,"model":"モデルID","choices":[{"delta":{"content":"お手伝いでき"},"index":0,"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1686901302,"model":"モデルID","choices":[{"delta":{"content":"ることがあれば"},"index":0,"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1686901302,"model":"モデルID","choices":[{"delta":{"content":"お知らせください。"},"index":0,"finish_reason":"stop"}]}

data: [DONE]
```

## エラーレスポンス

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

### 一般的なエラータイプ

- `invalid_request_error` - リクエストパラメータが無効な場合
- `token_limit_error` - トークン制限を超えた場合
- `rate_limit_error` - レート制限に達した場合
- `api_error` - APIの内部エラー
- `server_error` - サーバーの内部エラー

## 制限事項

- レート制限: 1分あたり10リクエスト
- トークン制限（モデルによる）:
  - gpt-4o: 128,000トークン
  - gpt-4o-mini: 32,000トークン
  - o1: 128,000トークン
  - o1-mini: 32,000トークン
  - claude-3.5-sonnet: 200,000トークン
