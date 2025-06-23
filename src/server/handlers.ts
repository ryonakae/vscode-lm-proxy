// APIエンドポイントのハンドラー実装
import express from 'express';
import { modelManager } from '../model/manager';
import { logger } from '../utils/logger';

/**
 * OpenAI互換のChat Completions APIエンドポイントを設定
 * @param app Express.jsアプリケーション
 */
export function setupChatCompletionsEndpoint(app: express.Express): void {
  // 両方のパターンのエンドポイントを登録（OpenAI API互換性の向上）
  app.post('/chat/completions', handleChatCompletions);
  app.post('/v1/chat/completions', handleChatCompletions);
}

/**
 * Chat Completionsリクエストのハンドラー
 */
async function handleChatCompletions(req: express.Request, res: express.Response) {
  try {
    // リクエストの検証
    const { messages, model, stream } = validateChatCompletionRequest(req.body);
    
    // ストリーミングモードのチェック
    const isStreaming = stream === true;
    
    if (isStreaming) {
        // ストリーミングレスポンスの設定
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        // ストリーミング開始をログに記録
        logger.logStreamStart(req.originalUrl || req.url);
        
        // チャンクのカウントを追跡
        let chunkIndex = 0;
        
        // モデルマネージャーを使用してストリーミングレスポンスを送信
        await modelManager.streamChatCompletion(messages, model, (chunk) => {
          const data = JSON.stringify(chunk);
          // チャンクをログに記録
          logger.logStreamChunk(req.originalUrl || req.url, chunk, chunkIndex++);
          res.write(`data: ${data}\n\n`);
        });
        
        // ストリーミング終了
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        // 非ストリーミングモードでレスポンスを取得
        const completion = await modelManager.getChatCompletion(messages, model);
        res.json(completion);
      }
    } catch (error) {
      logger.error(`Chat completions API error: ${(error as Error).message}`, error as Error);
      
      // エラーレスポンスの作成
      const apiError = error as any;
      const statusCode = apiError.statusCode || 500;
      const errorResponse = {
        error: {
          message: apiError.message || 'An unknown error has occurred',
          type: apiError.type || 'api_error',
          code: apiError.code || 'internal_error'
        }
      };
      
      res.status(statusCode).json(errorResponse);
    }
}

/**
 * リクエストのバリデーション
 * @param body リクエストボディ
 * @returns 検証済みのリクエストパラメータ
 */
function validateChatCompletionRequest(body: any): {
  messages: any[];
  model: string;
  stream?: boolean;
} {
  // 必須フィールドのチェック
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    const error: any = new Error('The messages field is required');
    error.statusCode = 400;
    error.type = 'invalid_request_error';
    throw error;
  }
  
  // モデルの必須チェック
  if (!body.model) {
    const error: any = new Error('The model field is required');
    error.statusCode = 400;
    error.type = 'invalid_request_error';
    throw error;
  }
  
  const model = body.model;
  
  // モデルが'vscode-lm-proxy'の場合、選択されたモデルがあるか確認
  if (model === 'vscode-lm-proxy' && !modelManager.getSelectedModel()) {
    const error: any = new Error('No valid model selected. Please select a model first.');
    error.statusCode = 400;
    error.type = 'invalid_request_error';
    throw error;
  }
  
  return {
    messages: body.messages,
    model,
    stream: body.stream
  };
}
