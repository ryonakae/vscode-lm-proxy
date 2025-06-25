// Express.jsサーバーの設定とAPIエンドポイントの実装
import express from 'express'
import { logger } from '../utils/logger'
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

    // レスポンスを捕捉するための元のメソッドを保持
    const originalSend = res.send
    const originalJson = res.json
    const originalEnd = res.end

    // カスタムのsendメソッド
    res.send = (body: any): express.Response => {
      const responseTime = Date.now() - startTime
      logger.info('Response sent', {
        status: res.statusCode,
        path,
        body,
        responseTime,
      })
      return originalSend.apply(res, arguments as any)
    }

    // カスタムのjsonメソッド
    res.json = (body: any): express.Response => {
      const responseTime = Date.now() - startTime
      logger.info('Response sent', {
        status: res.statusCode,
        path,
        body,
        responseTime,
      })
      return originalJson.apply(res, arguments as any)
    }

    // カスタムのendメソッド
    res.end = (chunk?: any): express.Response => {
      const responseTime = Date.now() - startTime
      if (chunk) {
        // Content-Typeがevent-streamの場合はストリーミング終了として記録
        if (res.getHeader('Content-Type') === 'text/event-stream') {
          logger.info('Response sent', { stream: 'end', path, responseTime })
        } else {
          logger.info('Response sent', {
            status: res.statusCode,
            path,
            body: chunk,
            responseTime,
          })
        }
      } else {
        // チャンクがない場合
        logger.info('Response sent', {
          status: res.statusCode,
          path,
          body: null,
          responseTime,
        })
      }
      return originalEnd.apply(res, arguments as any)
    }

    next()
  })

  // サーバーステータスエンドポイントのセットアップ
  setupStatusEndpoint(app)

  // OpenAI互換エンドポイントのセットアップ
  setupOpenAIEndpoints(app)
  setupOpenAIChatCompletionsEndpoints(app)
  setupOpenAIModelsEndpoints(app)

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
