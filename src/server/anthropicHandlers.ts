// Anthropic API互換ハンドラー
import express from 'express';
import * as vscode from 'vscode';
import { modelManager } from '../model/manager';
import { logger } from '../utils/logger';
import { getAnthropicModelInfo, getAnthropicModels, convertToAnthropicFormat, validateAndConvertAnthropicRequest } from '../model/anthropicConverter';
import { LmApiHandler } from './handlers';
import { limitsManager } from '../model/limits';

/**
 * ランダムなIDを生成（ツール呼び出し用）
 * @returns ランダム文字列
 */
function generateRandomId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Sets up all Anthropic-compatible API endpoints
 * @param app Express.js application
 */
export function setupAnthropicEndpoints(app: express.Express): void {
  // ルートエンドポイント
  setupAnthropicRootEndpoint(app);
  
  // メッセージおよびトークンカウント関連のエンドポイント
  setupAnthropicMessagesEndpoints(app);
  
  // モデル関連のエンドポイント
  setupAnthropicModelsEndpoints(app);

  // Claude Code専用エンドポイント
  setupClaudeCodeEndpoints(app);
}

/**
 * Sets up Anthropic root endpoint
 * @param app Express.js application
 */
function setupAnthropicRootEndpoint(app: express.Express): void {
  app.get('/anthropic', sendAnthropicRootResponse);
  app.get('/anthropic/v1', sendAnthropicRootResponse);
  app.get('/anthropic/v1/', sendAnthropicRootResponse);
}

/**
 * Sets up Anthropic Messages and Token Count API endpoints
 * @param app Express.js application
 */
function setupAnthropicMessagesEndpoints(app: express.Express): void {
  // Messages API
  app.post('/anthropic/v1/messages', handleAnthropicMessages);
  app.post('/anthropic/messages', handleAnthropicMessages);
  
  // Token Count API
  app.post('/anthropic/v1/messages/count_tokens', handleAnthropicCountTokens);
  app.post('/anthropic/messages/count_tokens', handleAnthropicCountTokens);
}

/**
 * Sets up Anthropic Models API endpoints
 * @param app Express.js application
 */
function setupAnthropicModelsEndpoints(app: express.Express): void {
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
    const { vscodeLmMessages, model: requestedModel, stream, originalMessages, tools, toolChoice } = validateAndConvertAnthropicRequest(req.body);
    
    // model: 'vscode-lm-proxy' または 'vscode-lm-api' の場合は設定モデル、それ以外はリクエストのモデルIDを使う
    const model = (requestedModel === 'vscode-lm-proxy' || requestedModel === 'vscode-lm-api')
      ? modelManager.getAnthropicModelId()
      : requestedModel;
    
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
        null, // モデルはgetAnthropicModelで既に解決済み
        (chunk) => {
          // Anthropic形式に変換してレスポンス
          const anthropicChunk = convertToAnthropicFormat(chunk, requestedModel, true); // 元のモデル名を使用
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
        null // モデルはgetAnthropicModelで既に解決済み
      );
      
      // ツール呼び出し情報を検出（もしあれば）
      let detectedToolCalls = undefined;
      
      // tools引数が指定されていた場合のみツール検出を試みる
      if (tools && tools.length > 0) {
        // レスポンステキストからツール呼び出し情報を抽出する処理を試みる
        // この例では簡易的な実装として、JSON形式のツール呼び出しを探します
        const responseText = result.responseText;
        if (responseText.includes('```json') && (responseText.includes('"type":') || responseText.includes('"name":'))) {
          try {
            const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch && jsonMatch[1]) {
              const toolCall = JSON.parse(jsonMatch[1].trim());
              if (toolCall && toolCall.name) {
                detectedToolCalls = [{
                  id: `call_${generateRandomId()}`,
                  type: toolCall.type || 'function',
                  name: toolCall.name,
                  input: toolCall.input || {}
                }];
              }
            }
          } catch (e) {
            logger.error('Failed to parse tool call from response:', e as Error);
          }
        }
      }
      
      // Anthropic形式に変換（ツール呼び出し情報を含む）
      const response = convertToAnthropicFormat(
        { content: result.responseText, isComplete: true },
        model,
        false,
        detectedToolCalls
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
async function handleAnthropicModels(_req: express.Request, res: express.Response) {
  try {
    // モデル一覧を返す
    const models = await getAnthropicModels();
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
async function handleAnthropicModelInfo(req: express.Request, res: express.Response) {
  try {
    const modelId = req.params.model;
    
    // モデル情報の取得
    const modelInfo = await getAnthropicModelInfo(modelId);
    
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
 * Sets up Claude Code specific endpoints
 * @param app Express.js application
 */
function setupClaudeCodeEndpoints(app: express.Express): void {
  // Claude Code専用メッセージ API
  app.post('/anthropic/claude/v1/messages', handleClaudeCodeMessages);
  app.post('/anthropic/claude/messages', handleClaudeCodeMessages);
  
  // Claude Code専用トークン数 API
  app.post('/anthropic/claude/v1/messages/count_tokens', handleAnthropicCountTokens);
  app.post('/anthropic/claude/messages/count_tokens', handleAnthropicCountTokens);
  
  // Claude Code専用モデル API
  app.get('/anthropic/claude/v1/models', handleAnthropicModels);
  app.get('/anthropic/claude/models', handleAnthropicModels);
  
  // Claude Code専用モデル情報 API
  app.get('/anthropic/claude/v1/models/:model', handleAnthropicModelInfo);
  app.get('/anthropic/claude/models/:model', handleAnthropicModelInfo);
}

/**
 * Claude Code専用 Messages API request handler
 */
async function handleClaudeCodeMessages(req: express.Request, res: express.Response) {
  try {
    // リクエストの検証
    const { vscodeLmMessages, model: requestedModel, stream, originalMessages, tools, toolChoice } = 
      validateAndConvertAnthropicRequest(req.body);
    
    // model: 'vscode-lm-proxy' または 'vscode-lm-api' の場合は設定モデル、それ以外はリクエストのモデルIDを使う
    const model = (requestedModel === 'vscode-lm-proxy' || requestedModel === 'vscode-lm-api')
      ? modelManager.getClaudeThinkModelId() // Claude CodeのデフォルトはThinkモデル
      : modelManager.mapClaudeCodeModel(requestedModel);
    
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
        null, // モデルはmapClaudeCodeModelで既に解決済み
        (chunk) => {
          // Anthropic形式に変換してレスポンス
          const anthropicChunk = convertToAnthropicFormat(chunk, requestedModel, true); // レスポンスには元のモデル名を使用
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
        null // モデルはmapClaudeCodeModelで既に解決済み
      );
      
      // ツール呼び出し情報を検出（もしあれば）
      let detectedToolCalls = undefined;
      
      // tools引数が指定されていた場合のみツール検出を試みる
      if (tools && tools.length > 0) {
        // レスポンステキストからツール呼び出し情報を抽出する処理を試みる
        const responseText = result.responseText;
        if (responseText.includes('```json') && (responseText.includes('"type":') || responseText.includes('"name":'))) {
          try {
            const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch && jsonMatch[1]) {
              const toolCall = JSON.parse(jsonMatch[1].trim());
              if (toolCall && toolCall.name) {
                detectedToolCalls = [{
                  id: `call_${generateRandomId()}`,
                  type: toolCall.type || 'function',
                  name: toolCall.name,
                  input: toolCall.input || {}
                }];
              }
            }
          } catch (e) {
            logger.error('Failed to parse tool call from response:', e as Error);
          }
        }
      }
      
      // Anthropic形式に変換（ツール呼び出し情報を含む）
      const response = convertToAnthropicFormat(
        { content: result.responseText, isComplete: true },
        requestedModel, // レスポンスには元のモデル名を使用
        false,
        detectedToolCalls
      );
      
      // トークン使用量情報を更新
      response.usage = {
        input_tokens: result.promptTokens,
        output_tokens: result.completionTokens
      };
      
      res.json(response);
    }
  } catch (error) {
    logger.error('Anthropic messages API error:', error as Error);
    const errorStatus = (error as any).statusCode || 500;
    const errorType = (error as any).type || 'api_error';
    const errorMessage = (error as Error).message || 'Unknown error';
    
    // エラーレスポンス
    const errorResponse = {
      error: {
        message: errorMessage,
        type: errorType
      }
    };
    
    res.status(errorStatus).json(errorResponse);
  }
}




