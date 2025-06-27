// Express.jsサーバーの設定とAPIエンドポイントの実装
import express from 'express'
import { logger } from '../utils/logger'
import {
  setupAnthropicEndpoints,
  setupAnthropicMessagesEndpoints,
  setupAnthropicModelsEndpoints,
} from './anthropicHandler'
import { setupStatusEndpoint } from './handlers'
import {
  setupOpenAIChatCompletionsEndpoints,
  setupOpenAIEndpoints,
  setupOpenAIModelsEndpoints,
} from './openaiHandlers'

/**
 * Express.jsサーバーのインスタンスを作成します。
 * OpenAI互換APIやステータスエンドポイントなどを含むルーティングを設定します。
 * @returns {express.Express} 設定済みのExpressアプリケーション
 */
export function createServer(): express.Express {
  const app = express()

  // JSONのパース設定
  app.use(express.json())

  // リクエスト・レスポンスのロギングミドルウェア
  app.use((req, res, next) => {
    const startTime = Date.now()
    const path = req.originalUrl || req.url

    res.on('finish', () => {
      const responseTime = Date.now() - startTime
      // 必要に応じてbodyは省略（Express標準ではbodyはここで取得できません）
      logger.info('Response sent', {
        status: res.statusCode,
        path,
        responseTime,
      })
    })

    next()
  })

  // サーバーステータスエンドポイントのセットアップ
  setupStatusEndpoint(app)

  // OpenAI互換エンドポイントのセットアップ
  setupOpenAIEndpoints(app)
  setupOpenAIChatCompletionsEndpoints(app)
  setupOpenAIModelsEndpoints(app)

  // Anthropic互換APIエンドポイントのセットアップ
  setupAnthropicEndpoints(app)
  setupAnthropicMessagesEndpoints(app)
  setupAnthropicModelsEndpoints(app)

  // エラーハンドラーの設定
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      logger.error('Server error:', err)
      res.status(500).json({
        error: {
          message: `Internal Server Error: ${err.message}`,
          type: 'server_error',
        },
      })
    },
  )

  return app
}
