import type express from 'express'
import type { APIError } from 'openai'
import type { PageResponse } from 'openai/pagination'
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
  Model,
} from 'openai/resources'
import * as vscode from 'vscode'
import {
  convertOpenAIRequestToVSCodeRequest,
  convertVSCodeResponseToOpenAIResponse,
} from '../converter/openaiConverter'
import { modelManager } from '../model/manager'
import { logger } from '../utils/logger'
import { getVSCodeModel } from './handler'

/**
 * OpenAI互換のAPIエンドポイントを設定する
 * @param {express.Express} app Express.jsアプリケーション
 * @returns {void}
 */
export function setupOpenAIEndpoints(app: express.Express): void {
  // completions
  app.post('/openai/v1/chat/completions', handleOpenAIChatCompletions)

  // モデル一覧
  app.get('/openai/v1/models', handleOpenAIModels)

  // 特定モデル情報
  app.get('/openai/v1/models/:model', handleOpenAIModelInfo)
}

/**
 * OpenAI互換のChat Completions APIリクエストを処理するメイン関数。
 * - リクエストバリデーション
 * - モデル取得
 * - LM APIへのリクエスト送信
 * - ストリーミング/非ストリーミングレスポンス処理
 * - エラーハンドリング
 * @param {express.Request} req リクエスト
 * @param {express.Response} res レスポンス
 * @returns {Promise<void>}
 */
async function handleOpenAIChatCompletions(
  req: express.Request,
  res: express.Response,
) {
  try {
    const body = req.body as ChatCompletionCreateParams
    logger.debug('Received request', { body })

    // 必須フィールドのバリデーション
    validateChatCompletionRequest(body)

    // モデル取得
    const { vsCodeModel } = await getVSCodeModel(body.model, 'openai')

    // ストリーミングモード判定
    const isStreaming = body.stream === true

    // OpenAIリクエスト→VSCode LM API形式変換
    const { messages, options, inputTokens } =
      await convertOpenAIRequestToVSCodeRequest(body, vsCodeModel)

    // キャンセラレーショントークン作成
    const cancellationToken = new vscode.CancellationTokenSource().token

    // LM APIへリクエスト送信
    const response = await vsCodeModel.sendRequest(
      messages,
      options,
      cancellationToken,
    )
    logger.debug('Received response from LM API')

    // レスポンスをOpenAI形式に変換
    const openAIResponse = convertVSCodeResponseToOpenAIResponse(
      response,
      vsCodeModel,
      isStreaming,
      inputTokens,
    )
    logger.debug('openAIResponse', {
      openAIResponse,
      vsCodeModel,
      isStreaming,
    })

    // ストリーミングレスポンス処理
    if (isStreaming) {
      await handleStreamingResponse(
        res,
        openAIResponse as AsyncIterable<ChatCompletionChunk>,
        req.originalUrl || req.url,
      )
      return
    }

    // 非ストリーミングレスポンス処理
    const completion = await (openAIResponse as Promise<ChatCompletion>)
    logger.debug('completion', { completion })
    res.json(completion)
  } catch (error) {
    const { statusCode, apiError } = handleChatCompletionError(
      error as vscode.LanguageModelError,
    )
    res.status(statusCode).json({ error: apiError })
  }
}

/**
 * Chat Completions APIリクエストの必須フィールドをバリデーションする
 * @param {ChatCompletionCreateParams} body
 * @throws エラー時は例外をスロー
 */
function validateChatCompletionRequest(body: ChatCompletionCreateParams) {
  // messagesフィールドの存在と配列チェック
  if (
    !body.messages ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0
  ) {
    const error: vscode.LanguageModelError = {
      ...new Error('The messages field is required'),
      name: 'InvalidMessageRequest',
      code: 'invalid_message_format',
    }
    throw error
  }

  // modelフィールドの存在チェック
  if (!body.model) {
    const error: vscode.LanguageModelError = {
      ...new Error('The model field is required'),
      name: 'InvalidModelRequest',
      code: 'invalid_model',
    }
    throw error
  }
}

/**
 * ストリーミングレスポンスを処理し、クライアントに送信する
 * @param {express.Response} res
 * @param {AsyncIterable<ChatCompletionChunk>} stream
 * @param {string} reqPath
 * @returns {Promise<void>}
 */
async function handleStreamingResponse(
  res: express.Response,
  stream: AsyncIterable<ChatCompletionChunk>,
  reqPath: string,
) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  logger.debug('Streaming started', { stream: 'start', path: reqPath })
  let chunkIndex = 0

  try {
    // ストリーミングレスポンスを逐次送信
    for await (const chunk of stream) {
      const data = JSON.stringify(chunk)
      res.write(`data: ${data}\n\n`)
      logger.debug(
        `Streaming chunk: ${JSON.stringify({ stream: 'chunk', chunk, index: chunkIndex++ })}`,
      )
    }

    // 正常終了
    res.write('data: [DONE]\n\n')
    logger.debug('Streaming ended', {
      stream: 'end',
      path: reqPath,
      chunkCount: chunkIndex,
    })
  } catch (error) {
    // エラー発生時はOpenAI互換エラーを送信し、ストリームを終了
    const { apiError } = handleChatCompletionError(
      error as vscode.LanguageModelError,
    )
    res.write(`data: ${JSON.stringify({ error: apiError })}\n\n`)
    res.write('data: [DONE]\n\n')
    logger.error('Streaming error', { error, path: reqPath })
  } finally {
    // ストリーム終了
    res.end()
  }
}

/**
 * VSCode LanguageModelError を OpenAI API 互換エラー形式に変換し、ログ出力する
 * @param {vscode.LanguageModelError} error
 * @returns { statusCode: number, apiError: APIError }
 */
function handleChatCompletionError(error: vscode.LanguageModelError): {
  statusCode: number
  apiError: APIError
} {
  logger.error('VSCode LM API error', {
    cause: error.cause,
    code: error.code,
    message: error.message,
    name: error.name,
    stack: error.stack,
  })

  // 変数を定義
  let statusCode = 500
  let type = 'api_error'
  let code = error.code || 'internal_error'
  let param: string | null = null

  // LanguageModelError.name に応じてマッピング
  switch (error.name) {
    case 'InvalidMessageFormat':
    case 'InvalidModel':
      statusCode = 400
      type = 'invalid_request_error'
      code =
        error.name === 'InvalidMessageFormat'
          ? 'invalid_message_format'
          : 'invalid_model'
      break
    case 'NoPermissions':
      statusCode = 403
      type = 'access_terminated'
      code = 'access_terminated'
      break
    case 'Blocked':
      statusCode = 403
      type = 'blocked'
      code = 'blocked'
      break
    case 'NotFound':
      statusCode = 404
      type = 'not_found_error'
      code = 'model_not_found'
      param = 'model'
      break
    case 'ChatQuotaExceeded':
      statusCode = 429
      type = 'insufficient_quota'
      code = 'quota_exceeded'
      break
    case 'Unknown':
      statusCode = 500
      type = 'server_error'
      code = 'internal_server_error'
      break
  }

  // OpenAI互換エラー形式で返却
  const apiError: APIError = {
    code,
    message: error.message || 'An unknown error has occurred',
    type,
    status: statusCode,
    headers: undefined,
    error: undefined,
    param,
    requestID: undefined,
    name: error.name || 'LanguageModelError',
  }
  logger.error(`OpenAI API error: ${apiError.message}`, apiError)

  return { statusCode, apiError }
}

/**
 * OpenAI互換のモデル一覧リクエストを処理する
 * @param {express.Request} req リクエスト
 * @param {express.Response} res レスポンス
 * @returns {Promise<void>}
 */
async function handleOpenAIModels(
  _req: express.Request,
  res: express.Response,
) {
  try {
    // 利用可能なモデルを取得
    const availableModels = await modelManager.getAvailableModels()

    // OpenAI API形式に変換
    const now = Math.floor(Date.now() / 1000)
    const modelsData: Model[] = availableModels.map(model => ({
      id: model.id,
      object: 'model',
      created: now,
      owned_by: model.vendor || 'vscode',
    }))

    // プロキシモデルIDも追加
    modelsData.push({
      id: 'vscode-lm-proxy',
      object: 'model',
      created: now,
      owned_by: 'vscode-lm-proxy',
    })

    const openAIModelsResponse: PageResponse<Model> = {
      object: 'list',
      data: modelsData,
    }

    res.json(openAIModelsResponse)
  } catch (error: any) {
    logger.error(`OpenAI Models API error: ${error.message}`, error as Error)

    // エラーレスポンスの作成
    const statusCode = error.statusCode || 500
    const errorResponse = {
      error: {
        message: error.message || 'An unknown error has occurred',
        type: error.type || 'api_error',
        code: error.code || 'internal_error',
      },
    }

    res.status(statusCode).json(errorResponse)
  }
}

/**
 * OpenAI互換の単一モデル情報リクエストを処理する
 * @param {express.Request} req リクエスト
 * @param {express.Response} res レスポンス
 * @returns {Promise<void>}
 */
async function handleOpenAIModelInfo(
  req: express.Request,
  res: express.Response,
) {
  try {
    const modelId = req.params.model

    if (modelId === 'vscode-lm-proxy') {
      // vscode-lm-proxyの場合、固定情報を返す
      const now = Math.floor(Date.now() / 1000)
      const openAIModel: Model = {
        id: 'vscode-lm-proxy',
        object: 'model',
        created: now,
        owned_by: 'vscode-lm-proxy',
      }
      res.json(openAIModel)
      return
    }

    // LM APIからモデル情報を取得
    const vsCodeModel = await modelManager.getModelInfo(modelId)

    // モデルが存在しない場合はエラーをスロー
    if (!vsCodeModel) {
      throw {
        ...new Error(`Model ${modelId} not found`),
        statusCode: 404,
        type: 'model_not_found_error',
      }
    }

    // OpenAI API形式に変換
    const openAIModel: Model = {
      id: vsCodeModel.id,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: vsCodeModel.vendor || 'vscode',
    }

    // レスポンスを返却
    res.json(openAIModel)
  } catch (error: any) {
    logger.error(
      `OpenAI Model info API error: ${error.message}`,
      error as Error,
    )

    // エラーレスポンスの作成
    const statusCode = error.statusCode || 500
    const errorResponse = {
      error: {
        message: error.message || 'An unknown error has occurred',
        type: error.type || 'api_error',
        code: error.code || 'internal_error',
      },
    }

    res.status(statusCode).json(errorResponse)
  }
}
