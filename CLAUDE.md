# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build
npm run compile          # Compile TypeScript
npm run watch           # Watch mode compilation

# Lint
npm run check           # Run Biome linter
biome check --write     # Auto-fix linting issues
```

## Architecture

This VS Code extension creates a proxy server that exposes VS Code's Language Model API as OpenAI/Anthropic-compatible REST APIs.

Key components:
- Server: Express-based REST API server (/src/server)
- Converters: Transform between OpenAI/Anthropic and VS Code formats (/src/converter)
- Model Management: Handles VS Code language model selection (/src/model)
- Command Handlers: VS Code command implementation (/src/commands)
- UI Components: Status bar integration (/src/ui)

API Endpoints:
- OpenAI chat completions API (/openai/v1/chat/completions)  
- Anthropic messages API (/anthropic/v1/messages)
- Full streaming support for both providers

Technical Requirements:
- VS Code 1.93.0+
- Not supported in virtual/untrusted workspaces 
- Local environment required (no remote workspace support)