// OpenAI API互換ハンドラー
import express from 'express';
import { modelManager } from '../model/manager';
import { logger } from '../utils/logger';
import { convertToOpenAIFormat, convertOpenAIRequestToVSCodeRequest } from '../model/openaiConverter';

/**
 * Sets up OpenAI-compatible Chat Completions API endpoint
 * @param app Express.js application
 */
export function setupChatCompletionsEndpoint(app: express.Express): void {
  // OpenAI API互換エンドポイントを登録
  app.post('/openai/chat/completions', handleOpenAIChatCompletions);
  app.post('/openai/v1/chat/completions', handleOpenAIChatCompletions);
}

/**
 * Sets up OpenAI-compatible Models API endpoints
 * @param app Express.js application
 */
export function setupModelsEndpoints(app: express.Express): void {
  // モデル一覧エンドポイント
  app.get('/openai/models', handleOpenAIModels);
  app.get('/openai/v1/models', handleOpenAIModels);
  
  // 特定モデル情報エンドポイント
  app.get('/openai/models/:model', handleOpenAIModelInfo);
  app.get('/openai/v1/models/:model', handleOpenAIModelInfo);
}

/**
 * Models list request handler
 */
async function handleOpenAIModels(_req: express.Request, res: express.Response) {
  try {
    const models = await modelManager.getAvailableModels();
    res.json(models);
  } catch (error) {
    logger.error(`OpenAI Models API error: ${(error as Error).message}`, error as Error);
    
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
 * Single model info request handler
 */
async function handleOpenAIModelInfo(req: express.Request, res: express.Response) {
  try {
    const modelId = req.params.model;
    
    // モデル情報の取得
    const modelInfo = await modelManager.getModelInfo(modelId);
    res.json(modelInfo);
  } catch (error) {
    logger.error(`OpenAI Model info API error: ${(error as Error).message}`, error as Error);
    
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
 * Chat Completions request handler
 */
async function handleOpenAIChatCompletions(req: express.Request, res: express.Response) {
  try {
    // リクエストの検証
    const { messages, model, stream } = validateOpenAIChatCompletionRequest(req.body);
    
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
          const data = JSON.stringify(convertToOpenAIFormat(chunk, model, true));
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
      logger.error(`OpenAI Chat completions API error: ${(error as Error).message}`, error as Error);
      
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
function validateOpenAIChatCompletionRequest(body: any): {
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
  
  // OpenAIリクエストをVSCodeリクエストに変換
  const { messages } = convertOpenAIRequestToVSCodeRequest(body);
  
  return {
    messages,
    model,
    stream: body.stream
  };
}

/**
 * Sets up server status endpoint
 * @param app Express.js application
 */
export function setupStatusEndpoint(app: express.Express): void {
  app.get('/', handleServerStatus);
}

/**
 * Server status request handler
 */
function handleServerStatus(_req: express.Request, res: express.Response) {
  res.json({
    status: 'ok',
    message: 'VSCode LM API Proxy server is running',
    version: '0.0.1',
    endpoints: {
      '/': {
        method: 'GET',
        description: 'Server status endpoint'
      },
      '/openai/chat/completions': {
        method: 'POST',
        description: 'OpenAI-compatible Chat Completions API'
      },
      '/openai/v1/chat/completions': {
        method: 'POST',
        description: 'OpenAI-compatible Chat Completions API (with `/v1/` prefix)'
      },
      '/openai/models': {
        method: 'GET',
        description: 'OpenAI-compatible Models API - List available models'
      },
      '/openai/v1/models': {
        method: 'GET',
        description: 'OpenAI-compatible Models API - List available models (with `/v1/` prefix)'
      },
      '/openai/models/:model': {
        method: 'GET',
        description: 'OpenAI-compatible Models API - Get specific model info'
      },
      '/openai/v1/models/:model': {
        method: 'GET',
        description: 'OpenAI-compatible Models API - Get specific model info (with `/v1/` prefix)'
      },
      '/anthropic/messages': {
        method: 'POST',
        description: 'Anthropic-compatible Messages API'
      },
      '/anthropic/v1/messages': {
        method: 'POST',
        description: 'Anthropic-compatible Messages API (with `/v1/` prefix)'
      },
      '/anthropic/messages/count_tokens': {
        method: 'POST',
        description: 'Anthropic-compatible Count Message Tokens API'
      },
      '/anthropic/v1/messages/count_tokens': {
        method: 'POST',
        description: 'Anthropic-compatible Count Message Tokens API (with `/v1/` prefix)'
      },
      '/anthropic/models': {
        method: 'GET',
        description: 'Anthropic-compatible Models API - List available models'
      },
      '/anthropic/v1/models': {
        method: 'GET',
        description: 'Anthropic-compatible Models API - List available models (with `/v1/` prefix)'
      },
      '/anthropic/models/:model': {
        method: 'GET',
        description: 'Anthropic-compatible Models API - Get specific model info'
      },
      '/anthropic/v1/models/:model': {
        method: 'GET',
        description: 'Anthropic-compatible Models API - Get specific model info (with `/v1/` prefix)'
      }
    }
  });
}
