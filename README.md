# LM Proxy

An extension that exposes the VSCode Language Model API as an OpenAI-compatible REST API.
This extension allows external applications to easily utilize the VSCode Language Model API.

## Features

- Exposes VSCode's LM API as an OpenAI-compatible REST API
- Supports multiple model families (gpt-4o, gpt-4o-mini, o1, o1-mini, claude-3.5-sonnet)
- Server management from the status bar
- Command palette commands for starting/stopping the server and selecting models
- Streaming response support
- Token limit and rate limit management
- Error handling

## Installation

### Install from Marketplace
1. Install from the VSCode Extension Marketplace
2. Alternatively, download the `.vsix` file and install using the "Install Extension from VSIX" feature in VSCode

### Test Local Development Version
To try the extension locally from the source code, follow these steps:

1. Clone the repository
   ```bash
   git clone https://github.com/user/vscode-lm-proxy.git
   cd vscode-lm-proxy
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Build the extension
   ```bash
   npm run compile
   ```

4. Run in Debug Mode
   - Press `F5` in VSCode
   - Or select "Run Extension" from the "Run and Debug" panel
   - A new VSCode window will open with the extension running in debug mode

## Usage

### Starting the Extension

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Select `LM Proxy: Select Language Model` and choose the model to use
3. Select `LM Proxy: Start LM Proxy Server` to start the server
4. The server status will be displayed in the status bar

### Using the API

Once the server is running, you can send requests to the `http://localhost:4000/chat/completions` endpoint in the same format as the OpenAI Chat Completions API:

```bash
curl -X POST http://localhost:4000/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "vscode-lm-proxy",
    "messages": [
      {"role": "system", "content": "You are an excellent AI assistant."},
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

> **Note**: Always specify `"vscode-lm-proxy"` for the `model` parameter. The actual model selection is done via the command palette within VSCode.

Streaming mode:

```bash
curl -X POST http://localhost:4000/chat/completions \
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

## API Reference

This section provides detailed information about the API features offered by LM Proxy.

### Base URL

```
http://localhost:4000
```

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
    "chat/completions": {
      "method": "POST",
      "description": "OpenAI-compatible Chat Completions API"
    }
  }
}
```

#### POST /chat/completions

Sends a chat completion request. This is an OpenAI Chat Completions API compatible interface.

##### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|---------|-------------|
| model | string | No | The ID of the model to use. If omitted or set to "vscode-lm-proxy", the model selected via the VSCode command palette will be used. If a specific model ID is provided, that model will be used. |
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

### Error Responses

If an error occurs, the server will return an appropriate HTTP status code and a JSON response in the following format:

```json
{
  "error": {
    "message": "Error message",
    "type": "Error type",
    "code": "Error code"
  }
}
```

#### Common Error Types

- `invalid_request_error` - Invalid request parameters
- `token_limit_error` - Token limit exceeded
- `rate_limit_error` - Rate limit reached
- `api_error` - Internal API error
- `server_error` - Internal server error

### Limitations

- Rate Limit: 10 requests per minute
- Token Limit (per model):
  - gpt-4o: 128,000 tokens
  - gpt-4o-mini: 32,000 tokens
  - o1: 128,000 tokens
  - o1-mini: 32,000 tokens
  - claude-3.5-sonnet: 200,000 tokens

## Commands

- `LM Proxy: Start LM Proxy Server` - Starts the proxy server
- `LM Proxy: Stop LM Proxy Server` - Stops the running proxy server
- `LM Proxy: Select Language Model` - Selects the language model to use

## Keyboard Shortcuts

- Start Server: `Ctrl+Shift+L S` (or `Cmd+Shift+L S` on Mac)
- Stop Server: `Ctrl+Shift+L X` (or `Cmd+Shift+L X` on Mac)
- Select Model: `Ctrl+Shift+L M` (or `Cmd+Shift+L M` on Mac)

## Limitations

- Token limits are approximate based on model families
- Subject to VSCode LM API limitations
- Model usage requires appropriate authentication and consent

# Troubleshooting Guide

This guide describes common issues you might encounter when using the VSCode LM Proxy extension and their solutions.

## Installation Issues

### Cannot Install Extension

**Symptom**: Extension installation fails.

**Solution**:
1. Ensure VSCode is updated to the latest version (1.93.0 or later).
2. Check your internet connection.
3. Restart VSCode and try installing again.
4. Check the VSCode Developer Tools Console for detailed error messages.

## Server Related Issues

### Server Does Not Start

**Symptom**: "Server startup error" message is displayed.

**Solution**:
1. Restart VSCode.
2. Check if another application is using port 4000.
   ```bash
   lsof -i :4000
   ```
3. If in use, terminate the process or change the port number in the extension settings.
4. Try running VSCode with administrator privileges.

### Server Stops Unexpectedly

**Symptom**: The server was running but stopped suddenly.

**Solution**:
1. Check the logs in the VSCode Output panel.
2. Check for memory shortage or other system resource issues.
3. Try disabling and re-enabling the extension.

## Model Selection Issues

### Cannot Select Model

**Symptom**: Running the model selection command shows nothing or displays an error.

**Solution**:
1. Ensure you have access to the VSCode Language Model API.
2. Check your internet connection.
3. Ensure the GitHub Copilot extension is installed and correctly configured.
4. Try restarting VSCode.

### Selected Model is Not Remembered

**Symptom**: The selected model resets after restarting the extension.

**Solution**:
1. Ensure your VSCode workspace or user settings are writable.
2. Try disabling and re-enabling the extension.

## API Usage Issues

### Request Times Out

**Symptom**: API requests take a long time to respond and time out.

**Solution**:
1. Check your network connection.
2. Ensure the request is not too complex.
3. Verify that the server is running.
4. Check if VSCode's memory usage is too high.

### Token Limit Error Occurs

**Symptom**: "Token limit exceeded" error is returned.

**Solution**:
1. Shorten the message in your request.
2. Split the request into multiple smaller requests.
3. Switch to a model with a larger context window.

### Rate Limit Error Occurs

**Symptom**: "Rate limit reached" error is returned.

**Solution**:
1. Reduce the frequency of your requests (default is 10 requests per minute).
2. Wait for a while and try again.
3. Consider combining multiple requests into one.

## Other Issues

### Status Bar Display Not Updating

**Symptom**: The status bar does not update even when the server status changes.

**Solution**:
1. Reload VSCode by running "Developer: Reload Window" from the Command Palette.
2. Try disabling and re-enabling the extension.

### Keybindings Not Working

**Symptom**: Commands are not executed with the configured keybindings.

**Solution**:
1. Check your keyboard shortcut settings to ensure keybindings do not conflict with other commands.
2. Try manually reconfiguring the keybinding in VSCode's "Keyboard Shortcuts" settings.

## Local Development Issues

### TypeScript Compile Errors

**Symptom**: Typescript errors occur during the build.

**Solution**:
Check for errors using
```bash
npm run watch
```
and ensure all necessary type definition files are present.

### Extension Not Loading

**Symptom**: The extension is not enabled.

**Solution**:
1. Check for errors in the VSCode Console (Help > Toggle Developer Tools).
2. Ensure `activationEvents` are correctly configured.
3. Ensure dependencies in `package.json` are correctly installed.

### Changes Not Reflected

**Symptom**: Behavior does not change after code modifications.

**Solution**:
1. Run `npm run compile` to build the latest changes.
2. Reload VSCode (Developer: Reload Window).

## If the Problem Persists

If the above solutions do not resolve the issue, please create an Issue including the following information:

1. VSCode version
2. Extension version
3. Operating system information
4. Detailed error message and stack trace (if possible)
5. Steps to reproduce the problem

Additionally, checking the console logs by opening the VSCode Developer Tools (Help > Toggle Developer Tools) may provide more detailed diagnostic information.

## Marketplace Publishing Information

### Compliance with Microsoft AI Guidelines

This extension complies with the following Microsoft AI guidelines:

- [Microsoft AI tools and practices guidelines](https://learn.microsoft.com/en-us/legal/cognitive-services/openai/transparency-note)
- [GitHub Copilot extensibility acceptable development policy](https://docs.github.com/en/copilot/overview-of-github-copilot/about-github-copilot-extensibility)

This extension meets the following requirements:

1. **Transparency**: Clearly informs the user that this extension uses AI models.
2. **Consent**: Obtains explicit user consent before using models.
3. **Security**: All data processing is done locally and no data is sent externally.
4. **Performance**: Optimizes performance through model selection and rate limiting.
5. **Accessibility**: Provides keyboard shortcuts for all features.

### Privacy and Data Collection

This extension operates according to the following privacy policy:

- User data is not sent externally.
- All processing is done within the local VSCode instance.
- Statistical information or usage data is not collected.
- Server functionality operates only within localhost.

### Required Permissions

This extension accesses the following VSCode APIs:

- `vscode.lm`: Access to the Language Model API
- Network features: Running an HTTP API server on localhost

User consent is obtained through the standard VSCode authentication flow when using models.

## Marketplace Publishing Checklist

Before publishing this extension to the Marketplace, please check the following items:

1. **Extension Manifest**
   - [x] All required fields in `package.json` are properly set.
   - [x] Icon, banner, categories, etc., are configured.
   - [x] License information is accurately stated.

2. **Documentation**
   - [x] README.md is complete and clearly explains usage.
   - [x] Includes screenshots or animated demos.
   - [x] Troubleshooting information is provided.

3. **Code Quality**
   - [x] All linter warnings are resolved.
   - [x] A test suite is implemented, and all tests pass.
   - [x] Error handling is properly implemented.

4. **Microsoft AI Guidelines**
   - [x] Complies with Microsoft AI tools and practices guidelines.
   - [x] Complies with GitHub Copilot extensibility acceptable development policy.
   - [x] Required privacy information and data usage explanations are provided.

5. **Dependency Optimization**
   - [x] Dependencies are kept to a minimum (only Express.js used).
   - [x] Only client-side open-source libraries are used.
   - [x] Large dependencies that could impact performance are excluded.

## License

MIT