// 共通ハンドラー処理
import * as vscode from 'vscode';
import express from 'express';
import { logger } from '../utils/logger';
import { limitsManager } from '../model/limits';

/**
 * LM APIとの通信を行う共通クラス
 * OpenAIとAnthropicの両方で使用する共通のロジックを提供
 */
export class LmApiHandler {
  /**
   * AsyncIterableなストリームを文字列に変換
   * @param stream 文字列のAsyncIterable
   * @returns 連結された文字列
   */
  public static async streamToString(stream: AsyncIterable<string>): Promise<string> {
    let result = '';
    for await (const chunk of stream) {
      result += chunk;
    }
    return result;
  }

  /**
   * チャット完了のレスポンスを取得（共通処理）
   * @param messages LM API形式のメッセージ配列
   * @param modelId 使用するモデルのID
   * @param selectedModelId 選択されたモデルID（vscode-lm-proxyの場合）
   * @returns LM APIからの生レスポンスとトークン情報
   */
  public static async getChatCompletionFromLmApi(
    messages: vscode.LanguageModelChatMessage[], 
    modelId: string,
    selectedModelId: string | null
  ): Promise<{
    responseText: string;
    promptTokens: number;
    completionTokens: number;
    model: vscode.LanguageModelChat;
  }> {
    try {
      // vscode-lm-proxyの場合は選択されたモデルを使用
      const actualModelId = modelId === 'vscode-lm-proxy' ? selectedModelId : modelId;
      
      // モデルが選択されていない場合
      if (!actualModelId) {
        throw new Error('No model selected. Please select a model first.');
      }
      
      // レート制限チェック
      const rateLimitError = limitsManager.checkRateLimit(actualModelId);
      if (rateLimitError) {
        const error = new Error(rateLimitError.message);
        (error as any).statusCode = 429; // Too Many Requests
        (error as any).type = 'rate_limit_error';
        throw error;
      }
      
      // トークン制限チェックは変換前のメッセージに対して実行する必要があるため
      // 各ハンドラーで実行する
      
      // VSCode LM APIを呼び出し
      // 最新のAPIではモデルを取得してからリクエストを送信
      const [model] = await vscode.lm.selectChatModels({ id: actualModelId });
      if (!model) {
        throw new Error(`Model ${actualModelId} not found`);
      }

      // プロンプトのトークン数を計算 - 各メッセージを個別に計算して合計
      let promptTokens = 0;
      for (const message of messages) {
        promptTokens += await model.countTokens(message);
      }
      
      const response = await model.sendRequest(
        messages,
        {},
        new vscode.CancellationTokenSource().token
      );
      
      // レスポンスをテキストに変換
      const responseText = await this.streamToString(response.text);
      
      // レスポンスのトークン数を計算
      const responseMessage = vscode.LanguageModelChatMessage.Assistant(responseText);
      const completionTokens = await model.countTokens(responseMessage);
      
      return {
        responseText,
        promptTokens,
        completionTokens,
        model
      };
    } catch (error) {
      logger.error('Chat completion error:', error as Error);
      throw error;
    }
  }

  /**
   * ストリーミングチャット完了を行う共通処理
   * @param messages LM API形式のメッセージ配列
   * @param modelId 使用するモデルのID
   * @param selectedModelId 選択されたモデルID（vscode-lm-proxyの場合）
   * @param onChunk チャンク受信時のコールバック関数
   */
  public static async streamChatCompletionFromLmApi(
    messages: vscode.LanguageModelChatMessage[], 
    modelId: string,
    selectedModelId: string | null,
    onChunk: (chunk: { content: string; isComplete?: boolean }) => void
  ): Promise<void> {
    try {
      // vscode-lm-proxyの場合は選択されたモデルを使用
      const actualModelId = modelId === 'vscode-lm-proxy' ? selectedModelId : modelId;
      
      // モデルが選択されていない場合
      if (!actualModelId) {
        throw new Error('No model selected. Please select a model first.');
      }
      
      // レート制限チェック
      const rateLimitError = limitsManager.checkRateLimit(actualModelId);
      if (rateLimitError) {
        const error = new Error(rateLimitError.message);
        (error as any).statusCode = 429; // Too Many Requests
        (error as any).type = 'rate_limit_error';
        throw error;
      }
      
      // VSCode LM APIを呼び出し
      const [model] = await vscode.lm.selectChatModels({ id: actualModelId });
      if (!model) {
        throw new Error(`Model ${actualModelId} not found`);
      }
      
      const response = await model.sendRequest(
        messages,
        {},
        new vscode.CancellationTokenSource().token
      );
      
      // 最初のチャンクを空で送信
      onChunk({ content: '', isComplete: false });
      
      // ストリーミングレスポンスを処理
      let fullContent = '';
      for await (const chunk of response.text) {
        fullContent += chunk;
        onChunk({ content: chunk, isComplete: false });
      }
      
      // 完了を通知
      onChunk({ content: '', isComplete: true });
      
      return;
    } catch (error) {
      logger.error('Stream chat completion error:', error as Error);
      throw error;
    }
  }
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
export function handleServerStatus(_req: express.Request, res: express.Response) {
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
    }
  });
}
