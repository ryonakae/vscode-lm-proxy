// 共通ハンドラー処理

import type express from 'express'
import * as vscode from 'vscode'
import { limitsManager } from '@/model/limits'
import { logger } from '@/utils/logger'

// モジュールスコープでglobalStateを管理
let globalState: vscode.Memento | undefined

/**
 * globalStateを初期化する
 * @param {vscode.Memento} state VSCodeのグローバルステート
 */
export function initializeLmApiHandler(state: vscode.Memento) {
  globalState = state
}

/**
 * LM APIとの通信を行う共通クラス
 * OpenAIとAnthropicの両方で使用する共通のロジックを提供
 */

/**
 * AsyncIterableなストリームを文字列に変換する
 * @param {AsyncIterable<string>} stream 文字列のストリーム
 * @returns {Promise<string>} 連結された文字列
 */
export async function streamToString(
  stream: AsyncIterable<string>,
): Promise<string> {
  let result = ''
  for await (const chunk of stream) {
    result += chunk
  }
  return result
}

/**
 * モデルIDを解決する
 * @param {string} modelId モデルID
 * @returns {string | null} 解決済みモデルIDまたはnull
 */
function resolveModelId(modelId: string): string | null {
  if (modelId === 'vscode-lm-api') {
    return globalState?.get<string>('openaiModelId') ?? null
  }
  return modelId
}

/**
 * チャット完了のレスポンスを取得する（共通処理）
 * @param {vscode.LanguageModelChatMessage[]} messages LM API形式のメッセージ配列
 * @param {string} modelId 使用するモデルのID
 * @returns {Promise<{responseText: string, promptTokens: number, completionTokens: number, model: vscode.LanguageModelChat}>} LM APIからの生レスポンスとトークン情報
 */
export async function getChatCompletionFromLmApi(
  messages: vscode.LanguageModelChatMessage[],
  modelId: string,
): Promise<{
  responseText: string
  promptTokens: number
  completionTokens: number
  model: vscode.LanguageModelChat
}> {
  try {
    const actualModelId = resolveModelId(modelId)
    if (!actualModelId) {
      throw new Error('No model selected. Please select a model first.')
    }
    // レート制限チェック
    const rateLimitError = limitsManager.checkRateLimit(actualModelId)
    if (rateLimitError) {
      throw new RateLimitError(rateLimitError.message)
    }
    // VSCode LM APIを呼び出し
    const [model] = await vscode.lm.selectChatModels({ id: actualModelId })
    if (!model) {
      throw new Error(`Model ${actualModelId} not found`)
    }
    // プロンプトのトークン数を計算
    let promptTokens = 0
    for (const message of messages) {
      promptTokens += await model.countTokens(message)
    }
    const response = await model.sendRequest(
      messages,
      {},
      new vscode.CancellationTokenSource().token,
    )
    const responseText = await streamToString(response.text)
    const responseMessage =
      vscode.LanguageModelChatMessage.Assistant(responseText)
    const completionTokens = await model.countTokens(responseMessage)
    return {
      responseText,
      promptTokens,
      completionTokens,
      model,
    }
  } catch (error) {
    logger.error('Chat completion error:', error as Error)
    throw error
  }
}

/**
 * ストリーミングチャット完了を行う共通処理
 * @param {vscode.LanguageModelChatMessage[]} messages LM API形式のメッセージ配列
 * @param {string} modelId 使用するモデルのID
 * @param {(chunk: { content: string; isComplete?: boolean }) => void} onChunk チャンク受信時のコールバック関数
 * @returns {Promise<void>}
 */
export async function streamChatCompletionFromLmApi(
  messages: vscode.LanguageModelChatMessage[],
  modelId: string,
  onChunk: (chunk: { content: string; isComplete?: boolean }) => void,
): Promise<void> {
  try {
    const actualModelId = resolveModelId(modelId)
    if (!actualModelId) {
      throw new Error('No model selected. Please select a model first.')
    }
    const rateLimitError = limitsManager.checkRateLimit(actualModelId)
    if (rateLimitError) {
      throw new RateLimitError(rateLimitError.message)
    }
    const [model] = await vscode.lm.selectChatModels({ id: actualModelId })
    if (!model) {
      throw new Error(`Model ${actualModelId} not found`)
    }
    const response = await model.sendRequest(
      messages,
      {},
      new vscode.CancellationTokenSource().token,
    )
    onChunk({ content: '', isComplete: false })
    for await (const chunk of response.text) {
      onChunk({ content: chunk, isComplete: false })
    }
    onChunk({ content: '', isComplete: true })
    return
  } catch (error) {
    logger.error('Stream chat completion error:', error as Error)
    throw error
  }
}

/**
 * レートリミット用のError拡張型（any回避用）
 * @extends {Error}
 */
class RateLimitError extends Error {
  statusCode: number
  type: string
  constructor(message: string) {
    super(message)
    this.statusCode = 429
    this.type = 'rate_limit_error'
    Object.setPrototypeOf(this, RateLimitError.prototype)
  }
}

/**
 * サーバーのステータス確認用エンドポイントを設定します。
 * @param {express.Express} app Express.jsアプリケーション
 */
export function setupStatusEndpoint(app: express.Express): void {
  app.get('/', handleServerStatus)
}

/**
 * サーバーのステータスリクエストを処理します。
 * @param {express.Request} _req リクエスト（未使用）
 * @param {express.Response} res レスポンス
 */
export function handleServerStatus(
  _req: express.Request,
  res: express.Response,
) {
  res.json({
    status: 'ok',
    message: 'VSCode LM API Proxy server is running',
    version: '0.0.1',
    endpoints: {
      '/': {
        method: 'GET',
        description: 'Server status endpoint',
      },
      '/openai/chat/completions': {
        method: 'POST',
        description: 'OpenAI-compatible Chat Completions API',
      },
      '/openai/v1/chat/completions': {
        method: 'POST',
        description:
          'OpenAI-compatible Chat Completions API (with `/v1/` prefix)',
      },
      '/openai/models': {
        method: 'GET',
        description: 'OpenAI-compatible Models API - List available models',
      },
      '/openai/v1/models': {
        method: 'GET',
        description:
          'OpenAI-compatible Models API - List available models (with `/v1/` prefix)',
      },
      '/openai/models/:model': {
        method: 'GET',
        description: 'OpenAI-compatible Models API - Get specific model info',
      },
      '/openai/v1/models/:model': {
        method: 'GET',
        description:
          'OpenAI-compatible Models API - Get specific model info (with `/v1/` prefix)',
      },
    },
  })
}
