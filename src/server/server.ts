// Express.jsサーバーの設定とAPIエンドポイントの実装
import express from 'express';
import { setupChatCompletionsEndpoint } from './handlers';
import { logger } from '../utils/logger';

/**
 * Express.jsサーバーのインスタンスを作成する
 * @returns 設定済みのExpressアプリケーション
 */
export function createServer(): express.Express {
  const app = express();
  
  // JSONのパース設定
  app.use(express.json());
  
  // リクエスト・レスポンスのロギングミドルウェア
  app.use((req, res, next) => {
    const startTime = Date.now();
    const path = req.originalUrl || req.url;
    const method = req.method;
    
    // リクエストをログ出力
    logger.logRequest(method, path, req.body);
    
    // レスポンスを捕捉するための元のメソッドを保持
    const originalSend = res.send;
    const originalJson = res.json;
    const originalEnd = res.end;
    
    // カスタムのsendメソッド
    res.send = function(body: any): express.Response {
      const responseTime = Date.now() - startTime;
      logger.logResponse(res.statusCode, path, body, responseTime);
      return originalSend.apply(res, arguments as any);
    };
    
    // カスタムのjsonメソッド
    res.json = function(body: any): express.Response {
      const responseTime = Date.now() - startTime;
      logger.logResponse(res.statusCode, path, body, responseTime);
      return originalJson.apply(res, arguments as any);
    };
    
    // カスタムのendメソッド
    res.end = function(chunk?: any): express.Response {
      const responseTime = Date.now() - startTime;
      if (chunk) {
        // Content-Typeがevent-streamの場合はストリーミング終了として記録
        if (res.getHeader('Content-Type') === 'text/event-stream') {
          logger.logStreamEnd(path, responseTime);
        } else {
          logger.logResponse(res.statusCode, path, chunk, responseTime);
        }
      } else {
        // チャンクがない場合
        logger.logResponse(res.statusCode, path, null, responseTime);
      }
      return originalEnd.apply(res, arguments as any);
    };
    
    next();
  });
  
  // ルートエンドポイント（OpenAI API互換性向上のため複数パターンをサポート）
  app.get('/', sendRootResponse);
  app.get('/v1', sendRootResponse);
  app.get('/v1/', sendRootResponse);
  
  // ルートエンドポイントのハンドラー関数
  function sendRootResponse(_req: express.Request, res: express.Response) {
    res.json({
      status: 'ok',
      message: 'VSCode LM API Proxy server is running',
      version: '0.0.1',
      endpoints: {
        'chat/completions': {
          method: 'POST',
          description: 'OpenAI互換のChat Completions API'
        },
        'v1/chat/completions': {
          method: 'POST',
          description: 'OpenAI互換のChat Completions API（`/v1/`プレフィックス版）'
        }
      }
    });
  };

  // OpenAI互換エンドポイントのセットアップ
  setupChatCompletionsEndpoint(app);
  
  // エラーハンドラーの設定
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('サーバーエラー:', err);
    res.status(500).json({
      error: {
        message: `内部サーバーエラー: ${err.message}`,
        type: 'server_error',
      }
    });
  });

  return app;
}
