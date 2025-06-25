// OpenAI API互換ハンドラー
import express from 'express';
import { modelManager } from '../model/manager';
import { logger } from '../utils/logger';
import { convertVSCodeResponseToOpenAIResponse, convertOpenAIRequestToVSCodeRequest, validateAndConvertOpenAIRequest } from '../model/openaiConverter';
import { LmApiHandler } from './handlers';
import { limitsManager } from '../model/limits';
import { OpenAIChatCompletionResponse } from '../model/types';
import OpenAI from 'openai';
import * as vscode from 'vscode';
import { convertOpenAIRequestToVSCodeRequest2, convertVSCodeResponseToOpenAIResponse2 } from '../converter/openaiConverter2';

export function setupOpenAIEndpoints(app: express.Express): void {
  app.get('/openai', handleOpenAIRootResponse);
  app.get('/openai/v1', handleOpenAIRootResponse);
  app.get('/openai/v1/', handleOpenAIRootResponse);
}

/**
 * Sets up OpenAI-compatible Chat Completions API endpoint
 * @param app Express.js application
 */
export function setupOpenAIChatCompletionsEndpoints(app: express.Express): void {
  // OpenAI API互換エンドポイントを登録
  app.post('/openai/chat/completions', handleOpenAIChatCompletions2);
  app.post('/openai/v1/chat/completions', handleOpenAIChatCompletions2);
}

/**
 * Sets up OpenAI-compatible Models API endpoints
 * @param app Express.js application
 */
export function setupOpenAIModelsEndpoints(app: express.Express): void {
  // モデル一覧エンドポイント
  app.get('/openai/models', handleOpenAIModels);
  app.get('/openai/v1/models', handleOpenAIModels);
  
  // 特定モデル情報エンドポイント
  app.get('/openai/models/:model', handleOpenAIModelInfo);
  app.get('/openai/v1/models/:model', handleOpenAIModelInfo);
}

function handleOpenAIRootResponse(_req: express.Request, res: express.Response) {
  res.json({
    status: 'ok',
    message: 'OpenAI API compatible endpoints',
    version: '0.0.1',
    endpoints: {
      'chat/completions': {
        method: 'POST',
        description: 'Chat Completions API'
      },
      'models': {
        method: 'GET',
        description: 'List available models'
      },
      'models/:model': {
        method: 'GET',
        description: 'Get model information'
      }
    }
  });
};

async function handleOpenAIChatCompletions2(req: express.Request, res: express.Response) {
  try {
    const body = req.body as OpenAI.ChatCompletionCreateParams;

    // 必須フィールドのチェック
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      const error: any = new Error('The messages field is required');
      error.statusCode = 400;
      error.type = 'invalid_request_error';
      throw error;
    }
    if (!body.model) {
      const error: any = new Error('The model field is required');
      error.statusCode = 400;
      error.type = 'invalid_request_error';
      throw error;
    }

    // モデルが'vscode-lm-proxy'の場合、選択中のOpenAIモデルがあるか確認し、modelを書き換える
    let modelId = body.model;
    if (modelId === 'vscode-lm-proxy') {
      const openaiModelId = modelManager.getOpenAIModelId();
      if (!openaiModelId) {
        const error: any = new Error('No valid OpenAI model selected. Please select a model first.');
        error.statusCode = 400;
        error.type = 'invalid_request_error';
        throw error;
      }
      modelId = openaiModelId;
    }

    // LM APIのモデルを取得
    const [model] = await vscode.lm.selectChatModels({ id: modelId });
    if (!model) {
      const error: any = new Error(`Model ${modelId} not found`);
      error.statusCode = 404;
      error.type = 'model_not_found_error';
      throw error;
    }

    // ストリーミングモードのチェック
    const isStreaming = body.stream === true;

    // OpenAI形式のリクエストをVSCode LM API形式に変換
    const { messages, options } = convertOpenAIRequestToVSCodeRequest2(body);
    logger.info('OpenAI Chat completions request', {model, messages, options});

    // キャンセラレーショントークンを作成
    const cancellationToken = new vscode.CancellationTokenSource().token;

    // LM APIにリクエストを送りレスポンスを取得
    const response = await model.sendRequest(messages, options, cancellationToken);
    logger.info('Received response from LM API', response);

    // レスポンスをOpenAI形式に変換
    const openAIResponseOrStream = convertVSCodeResponseToOpenAIResponse2(response, modelId);

    if (isStreaming) {
      // ストリーミング: AsyncIterableの場合
      // ストリーミングレスポンスの設定
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      // ストリーミング開始をログに記録
      logger.info('Streaming started', { stream: 'start', path: req.originalUrl || req.url });
      // チャンクのカウントを追跡
      let chunkIndex = 0;

      for await (const chunk of openAIResponseOrStream as AsyncIterable<OpenAI.ChatCompletionChunk>) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        // チャンクをログに記録
        logger.info('Streaming chunk', { stream: 'chunk', path: req.originalUrl || req.url, chunk, index: chunkIndex++ });
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // 非ストリーミング: Promiseの場合
      const completion = await (openAIResponseOrStream as Promise<OpenAI.ChatCompletion>);
      res.json(completion);
    }
  } catch (error) {
    logger.error('OpenAI Chat completions API error', { message: (error as Error).message, error: error as Error });
    
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
    const { messages, model, stream } = validateAndConvertOpenAIRequest(req.body);
    logger.info('OpenAI Chat completions request', {messages, model, stream});
    
    // OpenAI形式のリクエストをVSCode LM API形式に変換
    const vscodeLmRequest = convertOpenAIRequestToVSCodeRequest(req.body);
    
    // トークン制限チェック（元のメッセージに対して実行）
    const tokenLimitError = await limitsManager.validateTokenLimit(messages, model);
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
        logger.info({ stream: 'start', path: req.originalUrl || req.url });
        // チャンクのカウントを追跡
        let chunkIndex = 0;
        // 共通ハンドラーを使用してストリーミングレスポンスを送信
        await LmApiHandler.streamChatCompletionFromLmApi(
          vscodeLmRequest.messages, 
          model,
          (chunk) => {
            // OpenAI形式に変換してレスポンス
            const openAIChunk = convertVSCodeResponseToOpenAIResponse(chunk, model, true);
            const data = JSON.stringify(openAIChunk);
            // // チャンクをログに記録
            // logger.logStreamChunk(req.originalUrl || req.url, openAIChunk, chunkIndex++);
            res.write(`data: ${data}\n\n`);
          }
        );
        // ストリーミング終了
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        // 非ストリーミングモードでレスポンスを取得
        const result = await LmApiHandler.getChatCompletionFromLmApi(
          vscodeLmRequest.messages, 
          model
        );
        // OpenAI形式に変換
        const completion = convertVSCodeResponseToOpenAIResponse(
          { content: result.responseText, isComplete: true }, 
          model
        ) as OpenAIChatCompletionResponse;
        // トークン使用量情報を更新
        completion.usage = {
          prompt_tokens: result.promptTokens,
          completion_tokens: result.completionTokens,
          total_tokens: result.promptTokens + result.completionTokens,
          prompt_tokens_details: {
            cached_tokens: 0,
            audio_tokens: 0
          },
          completion_tokens_details: {
            reasoning_tokens: result.completionTokens,
            audio_tokens: 0,
            accepted_prediction_tokens: 0,
            rejected_prediction_tokens: 0
          }
        };
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
 * Models list request handler
 */
async function handleOpenAIModels(_req: express.Request, res: express.Response) {
  try {
    // 利用可能なモデルを取得
    const availableModels = await modelManager.getAvailableModels();
    
    // OpenAI API形式に変換
    const now = Math.floor(Date.now() / 1000);
    const modelsData = availableModels.map(model => ({
      id: model.id,
      object: 'model',
      created: now,
      owned_by: model.vendor || 'vscode'
    }));
    
    // プロキシモデルIDも追加
    modelsData.push({
      id: 'vscode-lm-proxy',
      object: 'model',
      created: now,
      owned_by: 'vscode-lm-proxy'
    });
    
    const openAIModelsResponse = {
      object: 'list',
      data: modelsData
    };
    
    res.json(openAIModelsResponse);
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
    if (modelId === 'vscode-lm-proxy') {
      // プロキシモデルの場合、固定情報を返す
      res.json({
        id: 'vscode-lm-proxy',
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'vscode-lm-proxy'
      });
      return;
    }
    
    const model = await modelManager.getModelInfo(modelId);
    if (!model) {
      const error: any = new Error(`Model ${modelId} not found`);
      error.statusCode = 404;
      error.type = 'model_not_found_error';
      throw error;
    }
    
    // OpenAI API形式に変換
    const modelInfo = {
      id: model.id,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: model.vendor || 'vscode'
    };
    
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



