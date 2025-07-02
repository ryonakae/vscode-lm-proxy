import type express from 'express'
import {
  handleAnthropicCountTokens,
  handleAnthropicMessages,
  handleAnthropicModelInfo,
  handleAnthropicModels,
} from './anthropicHandler'

/**
 * Claude Code互換のMessages APIエンドポイントを設定する
 * @param {express.Express} app Express.jsアプリケーション
 * @returns {void}
 */
export function setupClaudeCodeMessagesEndpoints(app: express.Express): void {
  app.post('/anthropic/claude/messages', (req, res) =>
    handleAnthropicMessages(req, res, 'claude'),
  )
  app.post('/anthropic/claude/v1/messages', (req, res) =>
    handleAnthropicMessages(req, res, 'claude'),
  )

  app.post('/anthropic/claude/messages/count_tokens', (req, res) =>
    handleAnthropicCountTokens(req, res, 'claude'),
  )
  app.post('/anthropic/claude/v1/messages/count_tokens', (req, res) =>
    handleAnthropicCountTokens(req, res, 'claude'),
  )
}

/**
 * Claude Code互換のModels APIエンドポイントを設定する
 * @param {express.Express} app Express.jsアプリケーション
 * @returns {void}
 */
export function setupClaudeCodeModelsEndpoints(app: express.Express): void {
  // モデル一覧エンドポイント
  app.get('/anthropic/claude/models', handleAnthropicModels)
  app.get('/anthropic/claude/v1/models', handleAnthropicModels)

  // 特定モデル情報エンドポイント
  app.get('/anthropic/claude/models/:model', handleAnthropicModelInfo)
  app.get('/anthropic/claude/v1/models/:model', handleAnthropicModelInfo)
}
