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
export function setupClaudeCodeEndpoints(app: express.Express): void {
  // messages
  app.post('/anthropic/claude/v1/messages', (req, res) =>
    handleAnthropicMessages(req, res, 'claude'),
  )

  // count_tokens
  app.post('/anthropic/claude/v1/messages/count_tokens', (req, res) =>
    handleAnthropicCountTokens(req, res, 'claude'),
  )

  // モデル一覧
  app.get('/anthropic/claude/v1/models', handleAnthropicModels)

  // 特定モデル情報
  app.get('/anthropic/claude/v1/models/:model', handleAnthropicModelInfo)
}
