// Anthropic API互換ハンドラー
import express from 'express';
import { modelManager } from '../model/manager';
import { logger } from '../utils/logger';
import { getAnthropicModelInfo, getAnthropicModels, convertToAnthropicFormat, convertAnthropicRequestToVSCodeRequest } from '../model/anthropicConverter';
import * as vscode from 'vscode';
import { LmApiHandler } from './handlers';
import { limitsManager } from '../model/limits';

/**
 * Sets up Anthropic-compatible API endpoints
 * @param app Express.js application
 */
export function setupAnthropicEndpoints(app: express.Express): void {
  // ルートエンドポイント
  app.get('/anthropic', sendAnthropicRootResponse);
  app.get('/anthropic/v1', sendAnthropicRootResponse);
  app.get('/anthropic/v1/', sendAnthropicRootResponse);
  
  // Messages API
  app.post('/anthropic/v1/messages', handleAnthropicMessages);
  app.post('/anthropic/messages', handleAnthropicMessages);
  
  // Token Count API
  app.post('/anthropic/v1/messages/count_tokens', handleAnthropicCountTokens);
  app.post('/anthropic/messages/count_tokens', handleAnthropicCountTokens);
  
  // Models API
  app.get('/anthropic/v1/models', handleAnthropicModels);
  app.get('/anthropic/models', handleAnthropicModels);
  
  // Model Info API
  app.get('/anthropic/v1/models/:model', handleAnthropicModelInfo);
  app.get('/anthropic/models/:model', handleAnthropicModelInfo);
}

/**
 * Anthropicルートエンドポイントのハンドラー関数
 */
function sendAnthropicRootResponse(_req: express.Request, res: express.Response) {
  res.json({
    status: 'ok',
    message: 'Anthropic API compatible endpoints',
    version: '0.0.1',
    endpoints: {
      'v1/messages': {
        method: 'POST',
        description: 'Messages API'
      },
      'v1/messages/count_tokens': {
        method: 'POST',
        description: 'Count Message Tokens API'
      },
      'v1/models': {
        method: 'GET',
        description: 'List available models'
      },
      'v1/models/:model': {
        method: 'GET',
        description: 'Get model information'
      }
    }
  });
}

/**
 * Anthropic Messages API request handler
 */
async function handleAnthropicMessages(req: express.Request, res: express.Response) {
  try {
    // リクエストの検証
    const { vscodeLmMessages, model, stream, originalMessages } = validateAnthropicMessagesRequest(req.body);
    
    // トークン制限チェック（元のメッセージに対して実行）
    const tokenLimitError = await limitsManager.validateTokenLimit(originalMessages, model);
    if (tokenLimitError) {
      const error = new Error(tokenLimitError.message);
      (error as any).statusCode = 400; // Bad Request
      (error as any).type = 'token_limit_error';
      throw error;
    }
    
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
      
      // 共通ハンドラーを使用してストリーミングレスポンスを送信
      await LmApiHandler.streamChatCompletionFromLmApi(
        vscodeLmMessages, 
        model, 
        modelManager.getSelectedModel(),
        (chunk) => {
          // Anthropic形式に変換してレスポンス
          const anthropicChunk = convertToAnthropicFormat(chunk, model, true);
          const data = JSON.stringify(anthropicChunk);
          // チャンクをログに記録
          logger.logStreamChunk(req.originalUrl || req.url, anthropicChunk, chunkIndex++);
          res.write(`data: ${data}\n\n`);
        }
      );
      
      // ストリーミング終了
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // 非ストリーミングモードでレスポンスを取得
      const result = await LmApiHandler.getChatCompletionFromLmApi(
        vscodeLmMessages, 
        model, 
        modelManager.getSelectedModel()
      );
      
      // Anthropic形式に変換
      const response = convertToAnthropicFormat(
        { content: result.responseText, isComplete: true },
        model
      );
      
      // トークン使用量情報を更新
      response.usage = {
        input_tokens: result.promptTokens,
        output_tokens: result.completionTokens
      };
      
      res.json(response);
    }
  } catch (error) {
    logger.error(`Anthropic messages API error: ${(error as Error).message}`, error as Error);
    
    // エラーレスポンスの作成
    const apiError = error as any;
    const statusCode = apiError.statusCode || 500;
    const errorResponse = {
      error: {
        message: apiError.message || 'An unknown error has occurred',
        type: apiError.type || 'api_error'
      }
    };
    
    res.status(statusCode).json(errorResponse);
  }
}

/**
 * Anthropic Count Tokens API request handler
 */
function handleAnthropicCountTokens(_req: express.Request, res: express.Response) {
  try {
    // 簡易的なトークン数カウントを実装
    // 実際にはより正確なトークナイザーが必要ですが、この実装ではダミー値を返します
    
    // 一定のトークン数を返す（実際のAnthropicのトークナイザーを使用する場合は修正が必要）
    res.json({
      input_tokens: 2095  // ダミー値
    });
  } catch (error) {
    logger.error(`Anthropic count tokens API error: ${(error as Error).message}`, error as Error);
    
    // エラーレスポンスの作成
    const apiError = error as any;
    const statusCode = apiError.statusCode || 500;
    const errorResponse = {
      error: {
        message: apiError.message || 'An unknown error has occurred',
        type: apiError.type || 'api_error'
      }
    };
    
    res.status(statusCode).json(errorResponse);
  }
}

/**
 * Anthropic Models list request handler
 */
function handleAnthropicModels(_req: express.Request, res: express.Response) {
  try {
    // モデル一覧を返す
    const models = getAnthropicModels();
    res.json(models);
  } catch (error) {
    logger.error(`Anthropic models API error: ${(error as Error).message}`, error as Error);
    
    // エラーレスポンスの作成
    const apiError = error as any;
    const statusCode = apiError.statusCode || 500;
    const errorResponse = {
      error: {
        message: apiError.message || 'An unknown error has occurred',
        type: apiError.type || 'api_error'
      }
    };
    
    res.status(statusCode).json(errorResponse);
  }
}

/**
 * Anthropic Model info request handler
 */
function handleAnthropicModelInfo(req: express.Request, res: express.Response) {
  try {
    const modelId = req.params.model;
    
    // モデル情報の取得
    const modelInfo = getAnthropicModelInfo(modelId);
    
    if (modelInfo) {
      res.json(modelInfo);
    } else {
      const error: any = new Error(`Model '${modelId}' not found`);
      error.statusCode = 404;
      error.type = 'model_not_found';
      throw error;
    }
  } catch (error) {
    logger.error(`Anthropic model info API error: ${(error as Error).message}`, error as Error);
    
    // エラーレスポンスの作成
    const apiError = error as any;
    const statusCode = apiError.statusCode || 404;
    const errorResponse = {
      error: {
        message: apiError.message || 'An unknown error has occurred',
        type: apiError.type || 'api_error'
      }
    };
    
    res.status(statusCode).json(errorResponse);
  }
}

/**
 * Anthropic Messages APIリクエストのバリデーション
 * @param body リクエストボディ
 * @returns 検証済みのリクエストパラメータ
 */
function validateAnthropicMessagesRequest(body: any): {
  vscodeLmMessages: vscode.LanguageModelChatMessage[];
  model: string;
  stream?: boolean;
  originalMessages: any[];
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

  // メッセージをVSCode形式に変換
  let vscodeLmMessages: vscode.LanguageModelChatMessage[] = [];
  
  // システムプロンプトがあれば、最初のユーザーメッセージとして追加
  if (body.system) {
    let systemContent = '';
    if (typeof body.system === 'string') {
      systemContent = body.system;
    } else if (Array.isArray(body.system)) {
      // 配列形式のシステムプロンプトを文字列に変換
      systemContent = body.system
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');
    }
    
    if (systemContent) {
      // システムプロンプトをユーザーメッセージとして先頭に追加
      vscodeLmMessages.push(vscode.LanguageModelChatMessage.User(`[SYSTEM] ${systemContent}`));
    }
  }
  
  // メッセージの変換
  for (const msg of body.messages) {
    // contentが配列の場合は、textのみを抽出
    let content = msg.content;
    if (Array.isArray(content)) {
      content = content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');
    }
    
    if (msg.role === 'user') {
      vscodeLmMessages.push(vscode.LanguageModelChatMessage.User(content));
    } else if (msg.role === 'assistant') {
      vscodeLmMessages.push(vscode.LanguageModelChatMessage.Assistant(content));
    } else {
      // その他のロールはユーザーメッセージとして扱う
      vscodeLmMessages.push(vscode.LanguageModelChatMessage.User(`[${msg.role}] ${content}`));
    }
  }
  
  return {
    vscodeLmMessages,
    model,
    stream: body.stream,
    originalMessages: body.messages
  };
}
