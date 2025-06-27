# LM Proxy

An extension that exposes the VSCode Language Model API as OpenAI and Anthropic compatible REST APIs, allowing external applications to easily utilize VSCode's language capabilities via industry-standard API formats.

## Features

- OpenAI and Anthropic compatible REST APIs for VSCode's Language Model API
- Support for multiple model families (gpt-4o, gpt-4o-mini, o1, o1-mini, claude-3.5-sonnet)
- Convenient server management via status bar and command palette
- Full streaming response support
- Built-in token limit and rate limit management
- Comprehensive error handling

## Installation

### Installation Steps
1. Install from the VSCode Extension Marketplace
2. Alternatively, download the `.vsix` file and install using the "Install Extension from VSIX" feature in VSCode

## Usage

### Starting the Extension

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Select `LM Proxy: Select Language Model` and choose the model to use
3. Select `LM Proxy: Start LM Proxy Server` to start the server
4. The server status will be displayed in the status bar

### Using the API

Once the server is running, you can use either the OpenAI or Anthropic compatible API endpoints from your applications, scripts, or command line.

#### OpenAI Compatible API

Send requests to either the `http://localhost:4000/openai/chat/completions` or `http://localhost:4000/openai/v1/chat/completions` endpoint in the same format as the OpenAI Chat Completions API:

```bash
curl -X POST http://localhost:4000/openai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "vscode-lm-proxy",
    "messages": [
      {"role": "system", "content": "You are an excellent AI assistant."},
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

OpenAI Streaming mode:

```bash
curl -X POST http://localhost:4000/openai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "vscode-lm-proxy",
    "messages": [
      {"role": "system", "content": "You are an excellent AI assistant."},
      {"role": "user", "content": "Hello!"}
    ],
    "stream": true
  }' --no-buffer
```

#### Anthropic Compatible API

Send requests to either the `http://localhost:4000/anthropic/messages` or `http://localhost:4000/anthropic/v1/messages` endpoint in the same format as the Anthropic Messages API:

```bash
curl -X POST http://localhost:4000/anthropic/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "vscode-lm-proxy",
    "system": "You are an excellent AI assistant.",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

Anthropic Streaming mode:

```bash
curl -X POST http://localhost:4000/anthropic/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "vscode-lm-proxy",
    "system": "You are an excellent AI assistant.",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": true
  }' --no-buffer
```

> **Note**: You must specify a model parameter. For OpenAI endpoints, use `"vscode-lm-proxy"` to use the model selected via the command palette within VSCode, or specify a specific model ID directly. For Anthropic endpoints, specify a Claude model ID such as `"claude-3.5-sonnet"` or `"claude-3-7-sonnet-20250219"`.

## API Reference

This section provides a comprehensive reference for all API endpoints offered by LM Proxy.

### Base URL

```
http://localhost:4000
```

OpenAI API endpoints:
- `http://localhost:4000/openai` - Standard endpoint
- `http://localhost:4000/openai/v1` - Full compatibility with OpenAI API client libraries

Anthropic API endpoints:
- `http://localhost:4000/anthropic` - Standard endpoint
- `http://localhost:4000/anthropic/v1` - Full compatibility with Anthropic API client libraries

> **Note**: The port number can be changed in the settings.

### Endpoints

#### GET /

Returns server status information.

##### Request

```bash
curl http://localhost:4000/
```

##### Response

```json
{
  "status": "ok",
  "message": "VSCode LM API Proxy server is running",
  "version": "0.0.1",
  "endpoints": {
    "/": {
      "method": "GET",
      "description": "Server status endpoint"
    },
    "/openai/chat/completions": {
      "method": "POST",
      "description": "OpenAI-compatible Chat Completions API"
    },
    "/openai/models": {
      "method": "GET",
      "description": "OpenAI-compatible Models API - List available models"
    },
    "/openai/models/:model": {
      "method": "GET",
      "description": "OpenAI-compatible Models API - Get specific model info"
    },
    "/anthropic/messages": {
      "method": "POST",
      "description": "Anthropic-compatible Messages API"
    },
    "/anthropic/messages/count_tokens": {
      "method": "POST",
      "description": "Anthropic-compatible Count Message Tokens API"
    },
    "/anthropic/models": {
      "method": "GET",
      "description": "Anthropic-compatible Models API - List available models"
    },
    "/anthropic/models/:model": {
      "method": "GET",
      "description": "Anthropic-compatible Models API - Get specific model info"
    }
  }
}
```

> **Note**: All endpoints are also available with the `/v1/` prefix for compatibility with API client libraries (e.g., `/openai/v1/chat/completions`, `/anthropic/v1/messages`, etc.)

#### GET /openai

Returns OpenAI API information. Also available at `/openai/v1/`.

##### Request

```bash
curl http://localhost:4000/openai/
```

##### Response

```json
{
  "status": "ok",
  "message": "OpenAI API compatible endpoints",
  "version": "0.0.1",
  "endpoints": {
    "chat/completions": {
      "method": "POST",
      "description": "Chat Completions API"
    },
    "models": {
      "method": "GET",
      "description": "List available models"
    },
    "models/:model": {
      "method": "GET",
      "description": "Get model information"
    }
  }
}
```

#### POST /openai/chat/completions

Sends a chat completion request. This is an OpenAI Chat Completions API compatible interface. Also available at `/openai/v1/chat/completions`.

##### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|---------|-------------|
| model | string | Yes | The ID of the model to use. Use "vscode-lm-proxy" to use the model selected via the VSCode command palette. If a specific model ID is provided, that model will be used. |
| messages | array | Yes | An array of chat messages |
| stream | boolean | No | Whether to enable streaming mode (default: false) |

##### Message Format

| Field | Type | Required | Description |
|-----------|------|---------|-------------|
| role | string | Yes | The role of the message ("system", "user", "assistant") |
| content | string | Yes | The content of the message |

##### Response

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1686901302,
  "model": "Model ID",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Hello! Please let me know if there is anything I can help you with."
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

##### Streaming Mode

If `stream: true` is specified, the server will return streaming responses in the following format:

```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1686901302,"model":"Model ID","choices":[{"delta":{"role":"assistant","content":"Hell"},"index":0,"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1686901302,"model":"Model ID","choices":[{"delta":{"content":"o!"},"index":0,"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1686901302,"model":"Model ID","choices":[{"delta":{"content":" Please let me"},"index":0,"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1686901302,"model":"Model ID","choices":[{"delta":{"content":" know if there is"},"index":0,"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1686901302,"model":"Model ID","choices":[{"delta":{"content":" anything I can help you with."},"index":0,"finish_reason":"stop"}]}

data: [DONE]
```

#### GET /openai/models

Returns a list of available models. This is an OpenAI Models API compatible interface. Also available at `/openai/v1/models`.

##### Request

```bash
curl http://localhost:4000/openai/models
```

##### Response

```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-4o",
      "object": "model",
      "created": 1686935002,
      "owned_by": "vscode"
    },
    {
      "id": "claude-3.5-sonnet",
      "object": "model",
      "created": 1686935002,
      "owned_by": "vscode"
    },
    {
      "id": "vscode-lm-proxy",
      "object": "model",
      "created": 1686935002,
      "owned_by": "vscode-lm-proxy"
    }
  ]
}
```

#### GET /openai/models/:model

Returns information about a specific model. This is an OpenAI Models API compatible interface. Also available at `/openai/v1/models/:model`.

##### Request

```bash
curl http://localhost:4000/openai/models/gpt-4o
```

##### Response

```json
{
  "id": "gpt-4o",
  "object": "model",
  "created": 1686935002,
  "owned_by": "vscode"
}
```

#### GET /anthropic

Returns Anthropic API information. Also available at `/anthropic/v1/`.

##### Request

```bash
curl http://localhost:4000/anthropic/
```

##### Response

```json
{
  "status": "ok",
  "message": "Anthropic API compatible endpoints",
  "version": "0.0.1",
  "endpoints": {
    "messages": {
      "method": "POST",
      "description": "Messages API"
    },
    "messages/count_tokens": {
      "method": "POST",
      "description": "Count Message Tokens API"
    },
    "models": {
      "method": "GET",
      "description": "List available models"
    },
    "models/:model": {
      "method": "GET",
      "description": "Get model information"
    }
  }
}
```

#### POST /anthropic/messages

Sends a message request. This is an Anthropic Messages API compatible interface. Also available at `/anthropic/v1/messages`.

##### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|---------|-------------|
| model | string | Yes | The ID of the model to use, such as "claude-3.5-sonnet" |
| messages | array | Yes | An array of chat messages |
| system | string | No | A system prompt to provide context for the message creation |
| stream | boolean | No | Whether to enable streaming mode (default: false) |

##### Message Format

| Field | Type | Required | Description |
|-----------|------|---------|-------------|
| role | string | Yes | The role of the message ("user" or "assistant") |
| content | string or array | Yes | The content of the message. Can be a string or an array of content blocks |

##### Response

```json
{
  "id": "msg_abc123",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Hello! Please let me know if there is anything I can help you with."
    }
  ],
  "model": "claude-3.5-sonnet",
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 0,
    "output_tokens": 0
  },
  "container": null
}
```

##### Streaming Mode

If `stream: true` is specified, the server will return streaming responses in the following format:

```
data: {"id":"msg_abc123","type":"message","role":"assistant","content":[{"type":"text","text":"Hello!"}],"model":"claude-3.5-sonnet","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":0,"output_tokens":0},"container":null}

data: {"id":"msg_abc123","type":"message","role":"assistant","content":[{"type":"text","text":" Please"}],"model":"claude-3.5-sonnet","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":0,"output_tokens":0},"container":null}

data: {"id":"msg_abc123","type":"message","role":"assistant","content":[{"type":"text","text":" let me know if there is anything I can help you with."}],"model":"claude-3.5-sonnet","stop_reason":"end_turn","stop_sequence":null,"usage":{"input_tokens":0,"output_tokens":0},"container":null}

data: [DONE]
```

#### POST /anthropic/messages/count_tokens

Counts tokens for a message request. This is an Anthropic Count Tokens API compatible interface. Also available at `/anthropic/v1/messages/count_tokens`.

##### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|---------|-------------|
| model | string | Yes | The ID of the model to use |
| messages | array | Yes | An array of chat messages |
| system | string | No | A system prompt to provide context for the message creation |

##### Response

```json
{
  "input_tokens": 2095
}
```

#### GET /anthropic/models

Returns a list of available Anthropic models. This is an Anthropic Models API compatible interface. Also available at `/anthropic/v1/models`.

##### Request

```bash
curl http://localhost:4000/anthropic/models
```

##### Response

```json
{
  "data": [
    {
      "id": "claude-3-7-sonnet-20250219",
      "type": "model",
      "display_name": "Claude 3.7 Sonnet",
      "created_at": "2025-02-19T00:00:00Z"
    },
    {
      "id": "claude-3-5-sonnet-20240620",
      "type": "model",
      "display_name": "Claude 3.5 Sonnet",
      "created_at": "2024-06-20T00:00:00Z"
    }
  ],
  "first_id": "claude-3-7-sonnet-20250219",
  "last_id": "claude-3-5-sonnet-20240620",
  "has_more": false
}
```

#### GET /anthropic/models/:model

Returns information about a specific Anthropic model. This is an Anthropic Models API compatible interface. Also available at `/anthropic/v1/models/:model`.

##### Request

```bash
curl http://localhost:4000/anthropic/models/claude-3-5-sonnet-20240620
```

##### Response

```json
{
  "id": "claude-3-5-sonnet-20240620",
  "type": "model",
  "display_name": "Claude 3.5 Sonnet",
  "created_at": "2024-06-20T00:00:00Z"
}
```
