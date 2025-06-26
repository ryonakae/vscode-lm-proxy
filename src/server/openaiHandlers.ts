// OpenAI API互換ハンドラー
import type express from 'express'
import type OpenAI from 'openai'
import type { APIError } from 'openai'
import * as vscode from 'vscode'
import {
  convertOpenAIRequestToVSCodeRequest,
  convertVSCodeResponseToOpenAIResponse,
} from '../converter/openaiConverter'
import { modelManager } from '../model/manager'
import { logger } from '../utils/logger'

/**
 * OpenAI互換APIのルートエンドポイントを設定する
 * @param {express.Express} app Express.jsアプリケーション
 * @returns {void}
 */
export function setupOpenAIEndpoints(app: express.Express): void {
  app.get('/openai', handleOpenAIRootResponse)
  app.get('/openai/v1', handleOpenAIRootResponse)
  app.get('/openai/v1/', handleOpenAIRootResponse)
}

/**
 * OpenAI互換のChat Completions APIエンドポイントを設定する
 * @param {express.Express} app Express.jsアプリケーション
 * @returns {void}
 */
export function setupOpenAIChatCompletionsEndpoints(
  app: express.Express,
): void {
  // OpenAI API互換エンドポイントを登録
  app.post('/openai/chat/completions', handleOpenAIChatCompletions)
  app.post('/openai/v1/chat/completions', handleOpenAIChatCompletions)
}

/**
 * OpenAI互換のModels APIエンドポイントを設定する
 * @param {express.Express} app Express.jsアプリケーション
 * @returns {void}
 */
export function setupOpenAIModelsEndpoints(app: express.Express): void {
  // モデル一覧エンドポイント
  app.get('/openai/models', handleOpenAIModels)
  app.get('/openai/v1/models', handleOpenAIModels)

  // 特定モデル情報エンドポイント
  app.get('/openai/models/:model', handleOpenAIModelInfo)
  app.get('/openai/v1/models/:model', handleOpenAIModelInfo)
}

/**
 * OpenAI互換APIのルートエンドポイントのレスポンスを返す
 * @param {express.Request} req リクエスト
 * @param {express.Response} res レスポンス
 * @returns {void}
 */
function handleOpenAIRootResponse(
  _req: express.Request,
  res: express.Response,
) {
  res.json({ status: 'ok' })
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
    const body = req.body as OpenAI.ChatCompletionCreateParams

    // 必須フィールドのバリデーション
    validateChatCompletionRequest(body)

    // モデル取得（'vscode-lm-proxy'対応含む）
    const { model, modelId } = await getVSCodeModel(body)

    // ストリーミングモード判定
    const isStreaming = body.stream === true

    // OpenAIリクエスト→VSCode LM API形式変換
    const { messages, options } = convertOpenAIRequestToVSCodeRequest(body)

    // キャンセラレーショントークン作成
    const cancellationToken = new vscode.CancellationTokenSource().token

    // LM APIへリクエスト送信
    const response = await model.sendRequest(
      messages,
      options,
      cancellationToken,
    )
    logger.info('Received response from LM API', response)

    // レスポンスをOpenAI形式に変換
    const openAIResponseOrStream = convertVSCodeResponseToOpenAIResponse(
      response,
      modelId,
      isStreaming,
    )

    // ストリーミングレスポンス処理
    if (isStreaming) {
      await handleStreamingResponse(
        res,
        openAIResponseOrStream as AsyncIterable<OpenAI.ChatCompletionChunk>,
        req.originalUrl || req.url,
      )
      return
    }

    // 非ストリーミングレスポンス処理
    const completion =
      await (openAIResponseOrStream as Promise<OpenAI.ChatCompletion>)
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
 * @param {OpenAI.ChatCompletionCreateParams} body
 * @throws エラー時は例外をスロー
 */
function validateChatCompletionRequest(
  body: OpenAI.ChatCompletionCreateParams,
) {
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
 * VSCode LM APIのモデルを取得する（'vscode-lm-proxy'時は選択中のOpenAIモデルに変換）
 * @param {OpenAI.ChatCompletionCreateParams} body
 * @returns {Promise<{ model: any, modelId: string }>}
 * @throws エラー時は例外をスロー
 */
async function getVSCodeModel(
  body: OpenAI.ChatCompletionCreateParams,
): Promise<{ model: any; modelId: string }> {
  let modelId = body.model

  // 'vscode-lm-proxy'の場合は選択中のOpenAIモデルIDに変換
  if (modelId === 'vscode-lm-proxy') {
    const openaiModelId = modelManager.getOpenAIModelId()
    if (!openaiModelId) {
      const error: vscode.LanguageModelError = {
        ...new Error(
          'No valid OpenAI model selected. Please select a model first.',
        ),
        name: 'NotFound',
        code: 'model_not_found',
      }
      throw error
    }
    modelId = openaiModelId
  }

  // モデル取得
  const [model] = await vscode.lm.selectChatModels({ id: modelId })
  if (!model) {
    const error: vscode.LanguageModelError = {
      ...new Error(`Model ${modelId} not found`),
      name: 'NotFound',
      code: 'model_not_found',
    }
    throw error
  }
  return { model, modelId }
}

/**
 * ストリーミングレスポンスを処理し、クライアントに送信する
 * @param {express.Response} res
 * @param {AsyncIterable<OpenAI.ChatCompletionChunk>} stream
 * @param {string} reqPath
 * @returns {Promise<void>}
 */
async function handleStreamingResponse(
  res: express.Response,
  stream: AsyncIterable<OpenAI.ChatCompletionChunk>,
  reqPath: string,
) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  logger.info('Streaming started', { stream: 'start', path: reqPath })
  let chunkIndex = 0

  try {
    // ストリーミングレスポンスを逐次送信
    for await (const chunk of stream) {
      const data = JSON.stringify(chunk)
      res.write(`data: ${data}\n\n`)
      logger.info(
        `Streaming chunk: ${JSON.stringify({ stream: 'chunk', chunk, index: chunkIndex++ })}`,
      )
    }

    // 正常終了
    res.write('data: [DONE]\n\n')
    logger.info('Streaming ended', {
      stream: 'end',
      path: reqPath,
      chunkCount: chunkIndex,
    })
  } catch (error) {
    // エラー発生時はOpenAI互換エラーをSSEで送信し、ストリームを終了
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

  // VSCodeのエラーをOpenAI互換のAPIエラーに変換
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
    case 'Blocked':
      statusCode = 403
      type = error.name === 'NoPermissions' ? 'access_terminated' : 'blocked'
      code = error.name === 'NoPermissions' ? 'access_terminated' : 'blocked'
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
    const modelsData = availableModels.map(model => ({
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

    const openAIModelsResponse = {
      object: 'list',
      data: modelsData,
    }

    res.json(openAIModelsResponse)
  } catch (error) {
    logger.error(
      `OpenAI Models API error: ${(error as Error).message}`,
      error as Error,
    )

    // エラーレスポンスの作成
    const apiError = error as any
    const statusCode = apiError.statusCode || 500
    const errorResponse = {
      error: {
        message: apiError.message || 'An unknown error has occurred',
        type: apiError.type || 'api_error',
        code: apiError.code || 'internal_error',
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

    // モデル情報の取得
    if (modelId === 'vscode-lm-proxy') {
      // プロキシモデルの場合、固定情報を返す
      res.json({
        id: 'vscode-lm-proxy',
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'vscode-lm-proxy',
      })
      return
    }

    const model = await modelManager.getModelInfo(modelId)
    if (!model) {
      const error: any = new Error(`Model ${modelId} not found`)
      error.statusCode = 404
      error.type = 'model_not_found_error'
      throw error
    }

    // OpenAI API形式に変換
    const modelInfo = {
      id: model.id,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: model.vendor || 'vscode',
    }

    res.json(modelInfo)
  } catch (error) {
    logger.error(
      `OpenAI Model info API error: ${(error as Error).message}`,
      error as Error,
    )

    // エラーレスポンスの作成
    const apiError = error as any
    const statusCode = apiError.statusCode || 500
    const errorResponse = {
      error: {
        message: apiError.message || 'An unknown error has occurred',
        type: apiError.type || 'api_error',
        code: apiError.code || 'internal_error',
      },
    }

    res.status(statusCode).json(errorResponse)
  }
}
