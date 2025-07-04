// Express.jsサーバーの設定とAPIエンドポイントの実装
import express from 'express'
import { logger } from '../utils/logger'
import { setupAnthropicEndpoints } from './anthropicHandler'
import { setupClaudeCodeEndpoints } from './claudeCodeHandler'
import { setupGeminiEndpoints } from './geminiHandler'
import { setupStatusEndpoint } from './handler'
import { setupOpenAIEndpoints } from './openaiHandler'

/**
 * Express.jsサーバーのインスタンスを作成します。
 * OpenAI互換APIやステータスエンドポイントなどを含むルーティングを設定します。
 * @returns {express.Express} 設定済みのExpressアプリケーション
 */
export function createServer(): express.Express {
  const app = express()

  // JSONのパース設定
  app.use(express.json({ limit: '100mb' }))

  // リクエスト・レスポンスのロギングミドルウェア
  app.use((req, res, next) => {
    const startTime = Date.now()
    const path = req.originalUrl || req.url

    // リクエスト受信時にログ出力
    logger.debug('Request received', {
      method: req.method,
      path,
      // requestBody: req.body,
    })

    res.on('finish', () => {
      const responseTime = Date.now() - startTime
      // 必要に応じてbodyは省略（Express標準ではbodyはここで取得できません）
      logger.debug('Response sent', {
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

  // Anthropic互換APIエンドポイントのセットアップ
  setupAnthropicEndpoints(app)

  // ClaudeCode互換APIエンドポイントのセットアップ
  setupClaudeCodeEndpoints(app)

  // Gemini互換APIエンドポイントのセットアップ
  setupGeminiEndpoints(app)

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
