// Express.jsサーバーの設定とAPIエンドポイントの実装
import express from 'express';
import { setupChatCompletionsEndpoint } from './handlers';

/**
 * Express.jsサーバーのインスタンスを作成する
 * @returns 設定済みのExpressアプリケーション
 */
export function createServer(): express.Express {
  const app = express();
  
  // JSONのパース設定
  app.use(express.json());
  
  // ルートエンドポイント
  app.get('/', (_req, res) => {
    res.json({
      status: 'ok',
      message: 'VSCode LM API Proxy server is running',
      version: '0.0.1',
      endpoints: {
        'chat/completions': {
          method: 'POST',
          description: 'OpenAI互換のChat Completions API'
        }
      }
    });
  });

  // OpenAI互換エンドポイントのセットアップ
  setupChatCompletionsEndpoint(app);
  
  // エラーハンドラーの設定
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('サーバーエラー:', err);
    res.status(500).json({
      error: {
        message: `内部サーバーエラー: ${err.message}`,
        type: 'server_error',
      }
    });
  });

  return app;
}
