# LM Proxy

An extension that exposes the VSCode Language Model API as OpenAI and Anthropic compatible REST APIs, allowing external applications to easily utilize VSCode's language capabilities via industry-standard API formats.

---

## Features

- **OpenAI & Anthropic Compatible APIs**: Exposes VSCode's Language Model API through REST APIs that are compatible with OpenAI's and Anthropic's formats.
- **Claude Code Support**: Provides endpoints compatible with Claude Code.
- **Multiple Model Support**: Seamlessly switch between different language models available in VSCode.
- **Server Management**: Easily start and stop the proxy server through the VSCode command palette or status bar.
- **Streaming Support**: Full support for streaming responses for real-time applications.
- **Flexible Configuration**: Customize the server port and log levels to fit your needs.

---

## Installation

1. Open the **Extensions** view in VSCode.
2. Search for "LM Proxy".
3. Click **Install**.

Alternatively, you can download the `.vsix` file from the [releases page](https://github.com/ryonakae/vscode-lm-proxy/releases) and install it manually using the "Install from VSIX..." command.

---

## Usage

### Starting the Server

1. Open the Command Palette.
2. Run the `LM Proxy: Start LM Proxy Server` command.
3. The server status will be displayed in the status bar.

### Stopping the Server

1. Open the Command Palette.
2. Run the `LM Proxy: Stop LM Proxy Server` command.

### Selecting a Language Model

1. Open the Command Palette.
2. Run one of the following commands:
   - `LM Proxy: Select OpenAI API Model`
   - `LM Proxy: Select Anthropic API Model` 
   - `LM Proxy: Select Claude Code Background Model`
   - `LM Proxy: Select Claude Code Thinking Model`
3. Choose your desired model from the list.

#### How Model Selection Works
- If you specify the model name as `vscode-lm-proxy`, the model selected in the extension settings will be used.
- If you specify a model name directly (e.g. `gpt-4.1` or `claude-3.5-sonnet`), that model will be used for the request.

---

## API Reference

The proxy server exposes the following endpoints:

### OpenAI Compatible API

- **Chat Completions**: `POST /openai/v1/chat/completions` (supports streaming via the `stream` parameter)

```bash
curl -X POST http://localhost:4000/openai/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "vscode-lm-proxy",
    "messages": [{"role":"user","content":"Hello!"}],
    "stream": true
  }'
```
- **List Models**: `GET /openai/v1/models`

```bash
curl http://localhost:4000/openai/v1/models
```
- **Retrieve Model**: `GET /openai/v1/models/{model}`

```bash
curl http://localhost:4000/openai/v1/models/gpt-4.1
```

### Anthropic Compatible API

- **Messages**: `POST /anthropic/v1/messages` (supports streaming via the `stream` parameter)

```bash
curl -X POST http://localhost:4000/anthropic/v1/messages \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "vscode-lm-proxy",
    "messages": [{"role":"user","content":"Hello!"}],
    "stream": true
  }'
```
- **Count Tokens**: `POST /anthropic/v1/messages/count_tokens` (counts the number of tokens in a message)

```bash
curl -X POST http://localhost:4000/anthropic/v1/messages/count_tokens \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "vscode-lm-proxy",
    "messages": [{"role":"user","content":"Hello, Claude"}]
  }'
```
- **List Models**: `GET /anthropic/v1/models`
- **Retrieve Model**: `GET /anthropic/v1/models/{model}`

### Claude Code Compatible API

- **Messages**: `POST /anthropic/claude/v1/messages` (supports streaming via the `stream` parameter)

```bash
curl -X POST http://localhost:4000/anthropic/claude/v1/messages \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "vscode-lm-proxy",
    "messages": [{"role":"user","content":"Hello!"}],
    "stream": true
  }'
```
- **Count Tokens**: `POST /anthropic/claude/v1/messages/count_tokens`
- **List Models**: `GET /anthropic/claude/v1/models`
- **Retrieve Model**: `GET /anthropic/claude/v1/models/{model}`

For detailed information about the request and response formats, please refer to the official [OpenAI API documentation](https://platform.openai.com/docs/api-reference) and [Anthropic API documentation](https://docs.anthropic.com/en/api/overview).

---

## Configuration

You can configure the extension settings in the VSCode settings UI or by editing your `settings.json` file.

- `vscode-lm-proxy.port`: The port number for the proxy server. (Default: `4000`)
- `vscode-lm-proxy.logLevel`: The log level for the extension. (Default: `1` for INFO)
- `vscode-lm-proxy.showOutputOnStartup`: Whether to show the output panel on startup. (Default: `false`)

---

## Commands

The following commands are available in the Command Palette:

- `LM Proxy: Start LM Proxy Server`: Starts the proxy server.
- `LM Proxy: Stop LM Proxy Server`: Stops the proxy server.
- `LM Proxy: Select OpenAI API Model`: Selects the OpenAI model to use.
- `LM Proxy: Select Anthropic API Model`: Selects the Anthropic model to use.
- `LM Proxy: Select Claude Code Background Model`: Selects the Claude Code background model to use.
- `LM Proxy: Select Claude Code Thinking Model`: Selects the Claude Code thinking model to use.
- `LM Proxy: Show Output Panel`: Shows the extension's output panel.
- `LM Proxy: Clear Output Panel`: Clears the extension's output panel.
- `LM Proxy: Set Log Level`: Sets the log level.

## License

This extension is licensed under the [MIT License](LICENSE).
