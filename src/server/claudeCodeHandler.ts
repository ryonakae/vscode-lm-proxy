import type express from 'express'
import {
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
  // Anthropic API互換エンドポイントを登録
  app.post('/anthropic/claude/messages', (req, res) =>
    handleAnthropicMessages(req, res, 'claude-code'),
  )
  app.post('/anthropic/v1/claude/messages', (req, res) =>
    handleAnthropicMessages(req, res, 'claude-code'),
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
  app.get('/anthropic/v1/claude/models', handleAnthropicModels)

  // 特定モデル情報エンドポイント
  app.get('/anthropic/claude/models/:model', handleAnthropicModelInfo)
  app.get('/anthropic/v1/claude/models/:model', handleAnthropicModelInfo)
}
