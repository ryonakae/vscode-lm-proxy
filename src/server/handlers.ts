// 共通ハンドラー処理

import type express from 'express'
import type * as vscode from 'vscode'

// モジュールスコープでglobalStateを管理
let _globalState: vscode.Memento | undefined

/**
 * globalStateを初期化する
 * @param {vscode.Memento} state VSCodeのグローバルステート
 */
export function initializeLmApiHandler(state: vscode.Memento) {
  _globalState = state
}

/**
 * サーバーのステータス確認用エンドポイントを設定します。
 * @param {express.Express} app Express.jsアプリケーション
 */
export function setupStatusEndpoint(app: express.Express): void {
  app.get('/', handleServerStatus)
}

/**
 * サーバーのステータスリクエストを処理します。
 * @param {express.Request} _req リクエスト（未使用）
 * @param {express.Response} res レスポンス
 */
export function handleServerStatus(
  _req: express.Request,
  res: express.Response,
) {
  res.json({
    status: 'ok',
    message: 'VSCode LM API Proxy server is running',
    version: '0.0.1',
    endpoints: {
      '/': {
        method: 'GET',
        description: 'Server status endpoint',
      },
      '/openai/chat/completions': {
        method: 'POST',
        description: 'OpenAI-compatible Chat Completions API',
      },
      '/openai/v1/chat/completions': {
        method: 'POST',
        description:
          'OpenAI-compatible Chat Completions API (with `/v1/` prefix)',
      },
      '/openai/models': {
        method: 'GET',
        description: 'OpenAI-compatible Models API - List available models',
      },
      '/openai/v1/models': {
        method: 'GET',
        description:
          'OpenAI-compatible Models API - List available models (with `/v1/` prefix)',
      },
      '/openai/models/:model': {
        method: 'GET',
        description: 'OpenAI-compatible Models API - Get specific model info',
      },
      '/openai/v1/models/:model': {
        method: 'GET',
        description:
          'OpenAI-compatible Models API - Get specific model info (with `/v1/` prefix)',
      },
    },
  })
}
