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
 * @param {express.Request} _req リクエスト（未使用）
 * @param {express.Response} res レスポンス
 * @returns {void}
 */
function handleOpenAIRootResponse(
  _req: express.Request,
  res: express.Response,
) {
  res.json({
    status: 'ok',
    message: 'OpenAI API compatible endpoints',
    version: '0.0.1',
    endpoints: {
      'chat/completions': {
        method: 'POST',
        description: 'Chat Completions API',
      },
      models: {
        method: 'GET',
        description: 'List available models',
      },
      'models/:model': {
        method: 'GET',
        description: 'Get model information',
      },
    },
  })
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
    handleChatCompletionError(res, error)
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
  if (
    !body.messages ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0
  ) {
    const error: any = new Error('The messages field is required')
    error.statusCode = 400
    error.type = 'invalid_request_error'
    throw error
  }
  if (!body.model) {
    const error: any = new Error('The model field is required')
    error.statusCode = 400
    error.type = 'invalid_request_error'
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
      const error: any = new Error(
        'No valid OpenAI model selected. Please select a model first.',
      )
      error.statusCode = 400
      error.type = 'invalid_request_error'
      throw error
    }
    modelId = openaiModelId
  }

  // モデル取得
  const [model] = await vscode.lm.selectChatModels({ id: modelId })
  if (!model) {
    const error: any = new Error(`Model ${modelId} not found`)
    error.statusCode = 404
    error.type = 'model_not_found_error'
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
  // レスポンスヘッダー設定
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  // ストリーミング開始ログ
  logger.info('Streaming started', { stream: 'start', path: reqPath })
  let chunkIndex = 0

  // チャンクごとに送信
  for await (const chunk of stream) {
    const data = JSON.stringify(chunk)
    res.write(`data: ${data}\n\n`)
    logger.info(
      `Streaming chunk: ${JSON.stringify({ stream: 'chunk', chunk, index: chunkIndex++ })}`,
    )
  }

  // 終了通知
  res.write('data: [DONE]\n\n')
  logger.info('Streaming ended', {
    stream: 'end',
    path: reqPath,
    chunkCount: chunkIndex,
  })
  res.end()
}

/**
 * Chat Completions APIのエラーハンドリング（OpenAI互換エラー形式で返す）
 * @param {express.Response} res
 * @param {unknown} error
 */
function handleChatCompletionError(res: express.Response, error: unknown) {
  const lmError = error as vscode.LanguageModelError

  logger.error(
    'OpenAI Chat completions API error',
    lmError.cause,
    lmError.code,
    lmError.message,
    lmError.name,
    lmError.stack,
  )

  // VSCodeのエラーをOpenAI互換のAPIエラーに変換
  let statusCode = 500
  let type = 'api_error'
  let code = lmError.code || 'internal_error'

  // LanguageModelError.code に応じてマッピング
  if (code === 'NotFound') {
    statusCode = 404
    type = 'model_not_found_error'
    code = 'model_not_found'
  } else if (code === 'NoPermissions') {
    statusCode = 403
    type = 'permission_denied'
    code = 'no_permissions'
  } else if (code === 'Blocked') {
    statusCode = 403
    type = 'blocked'
    code = 'blocked'
  } else if (code === 'Unknown') {
    statusCode = 500
    type = 'api_error'
    code = 'unknown'
  }

  // OpenAI互換エラー形式で返却
  const apiError: APIError = {
    code,
    message: lmError.message || 'An unknown error has occurred',
    type,
    status: statusCode,
    headers: undefined,
    error: undefined,
    param: undefined,
    requestID: undefined,
    name: lmError.name || 'LanguageModelError',
  }
  res.status(statusCode).json({ error: apiError })
}

/**
 * OpenAI互換のモデル一覧リクエストを処理する
 * @param {express.Request} _req リクエスト（未使用）
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
