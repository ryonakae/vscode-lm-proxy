import type { PageResponse } from '@anthropic-ai/sdk/core/pagination'
import type {
  ErrorObject,
  Message,
  MessageCreateParams,
  MessageTokensCount,
  ModelInfo,
  RawMessageStreamEvent,
} from '@anthropic-ai/sdk/resources'
import type express from 'express'
import * as vscode from 'vscode'
import {
  convertAnthropicRequestToVSCodeRequest,
  convertVSCodeResponseToAnthropicResponse,
} from '../converter/anthropicConverter'
import { modelManager } from '../model/manager'
import { logger } from '../utils/logger'
import { getVSCodeModel } from './handler'

/**
 * Anthropic互換のAPIエンドポイントを設定する
 * @param {express.Express} app Express.jsアプリケーション
 * @returns {void}
 */
export function setupAnthropicEndpoints(app: express.Express): void {
  // messages
  app.post('/anthropic/messages', (req, res) =>
    handleAnthropicMessages(req, res, 'anthropic'),
  )
  app.post('/anthropic/v1/messages', (req, res) =>
    handleAnthropicMessages(req, res, 'anthropic'),
  )

  // count_tokens
  app.post('/anthropic/v1/messages/count_tokens', (req, res) =>
    handleAnthropicCountTokens(req, res, 'anthropic'),
  )

  // モデル一覧
  app.get('/anthropic/models', handleAnthropicModels)
  app.get('/anthropic/v1/models', handleAnthropicModels)

  // 特定モデル情報
  app.get('/anthropic/models/:model', handleAnthropicModelInfo)
  app.get('/anthropic/v1/models/:model', handleAnthropicModelInfo)
}

/**
 * Anthropic互換のMessages APIリクエストを処理するメイン関数。
 * - リクエストバリデーション
 * - モデル取得
 * - LM APIへのリクエスト送信
 * - ストリーミング/非ストリーミングレスポンス処理
 * - エラーハンドリング
 * @param {express.Request} req リクエスト
 * @param {express.Response} res レスポンス
 * @returns {Promise<void>}
 */
export async function handleAnthropicMessages(
  req: express.Request,
  res: express.Response,
  provider: 'anthropic' | 'claude',
) {
  try {
    const body = req.body as MessageCreateParams
    logger.debug('Received anthropic request', { body })

    // 必須フィールドのバリデーション
    validateMessagesRequest(body)

    // モデル取得
    const { vsCodeModel } = await getVSCodeModel(body.model, provider)

    // ストリーミングモード判定
    const isStreaming = body.stream === true

    //Anthropicリクエスト→VSCode LM API形式変換
    const { messages, options, inputTokens } =
      await convertAnthropicRequestToVSCodeRequest(body, vsCodeModel)

    // キャンセラレーショントークン作成
    const cancellationToken = new vscode.CancellationTokenSource().token

    // LM APIへリクエスト送信
    const response = await vsCodeModel.sendRequest(
      messages,
      options,
      cancellationToken,
    )
    logger.debug('Received response from LM API')

    // レスポンスをAnthropic形式に変換
    const anthropicResponse = convertVSCodeResponseToAnthropicResponse(
      response,
      vsCodeModel,
      isStreaming,
      inputTokens,
    )
    logger.debug('anthropicResponse', {
      anthropicResponse,
      vsCodeModel,
      isStreaming,
    })

    // ストリーミングレスポンス処理
    if (isStreaming) {
      await handleStreamingResponse(
        res,
        anthropicResponse as AsyncIterable<RawMessageStreamEvent>,
        req.originalUrl || req.url,
      )
      return
    }

    // 非ストリーミングレスポンス処理
    const message = await (anthropicResponse as Promise<Message>)
    logger.debug('message', { message })
    res.json(message)
  } catch (error) {
    const { statusCode, errorObject } = handleMessageError(
      error as vscode.LanguageModelError,
    )
    res.status(statusCode).json({ type: 'error', error: errorObject })
  }
}

/**
 * Messages APIリクエストの必須フィールドをバリデーションする
 * @param {MessageCreateParams} body
 * @throws エラー時は例外をスロー
 */
function validateMessagesRequest(body: MessageCreateParams) {
  // messagesフィールドの存在と配列チェック
  if (
    !body.messages ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0
  ) {
    const error: vscode.LanguageModelError = {
      ...new Error('The messages field is required'),
      name: 'InvalidMessageRequest',
      code: 'invalid_request_error',
    }
    throw error
  }

  // modelフィールドの存在チェック
  if (!body.model) {
    const error: vscode.LanguageModelError = {
      ...new Error('The model field is required'),
      name: 'InvalidModelRequest',
      code: 'not_found_error',
    }
    throw error
  }
}

/**
 * ストリーミングレスポンスを処理し、クライアントに送信する
 * @param {express.Response} res
 * @param {AsyncIterable<RawMessageStreamEvent>} stream
 * @param {string} reqPath
 * @returns {Promise<void>}
 */
async function handleStreamingResponse(
  res: express.Response,
  stream: AsyncIterable<RawMessageStreamEvent>,
  reqPath: string,
): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  logger.debug('Streaming started', { path: reqPath })
  let chunkIndex = 0

  try {
    // ストリーミングレスポンスを逐次送信
    for await (const chunk of stream) {
      const data = JSON.stringify(chunk)
      res.write(`data: ${data}\n\n`)
      logger.debug(`Streaming chunk: ${data}`)
      chunkIndex++
    }

    // 正常終了
    logger.debug('Streaming ended', {
      path: reqPath,
      chunkCount: chunkIndex,
    })
  } catch (error) {
    // エラー発生時はAnthropic互換エラーを送信し、ストリームを終了
    const { errorObject } = handleMessageError(
      error as vscode.LanguageModelError,
    )
    res.write(
      `data: ${JSON.stringify({ type: 'error', error: errorObject })}\n\n`,
    )
    logger.error('Streaming error', { error, path: reqPath })
  } finally {
    // ストリーム終了
    res.end()
  }
}

/**
 * VSCode LanguageModelError を Anthropic 互換エラー形式に変換し、ログ出力する
 * @param {vscode.LanguageModelError} error
 * @returns { statusCode: number, errorObject: ErrorObject }
 */
function handleMessageError(error: vscode.LanguageModelError): {
  statusCode: number
  errorObject: ErrorObject
} {
  logger.error('VSCode LM API error', error, {
    cause: error.cause,
    code: error.code,
    message: error.message,
    name: error.name,
    stack: error.stack,
  })

  // 変数を定義
  let statusCode = 500
  let type: ErrorObject['type'] = 'api_error'
  let message = error.message || 'An unknown error has occurred'

  // LanguageModelError.name に応じてマッピング
  switch (error.name) {
    case 'InvalidMessageFormat':
    case 'InvalidModel':
      statusCode = 400
      type = 'invalid_request_error'
      break
    case 'NoPermissions':
      statusCode = 403
      type = 'permission_error'
      break
    case 'Blocked':
      statusCode = 403
      type = 'permission_error'
      break
    case 'NotFound':
      statusCode = 404
      type = 'not_found_error'
      break
    case 'ChatQuotaExceeded':
      statusCode = 429
      type = 'rate_limit_error'
      break
    case 'Error': {
      // エラーコード（数値）とJSON部分を抽出し、変数に格納
      const match = error.message.match(/Request Failed: (\d+)\s+({.*})/)

      if (match) {
        const status = Number(match[1])
        const jsonString = match[2]
        const errorJson = JSON.parse(jsonString)
        console.log(status)
        console.log(errorJson)

        statusCode = status
        type = errorJson.error.type
        message = errorJson.error.message
      }

      break
    }
    case 'Unknown':
      statusCode = 500
      type = 'api_error'
      break
  }

  // Anthropic互換エラー形式で返却
  const errorObject: ErrorObject = {
    type,
    message,
  }

  return { statusCode, errorObject }
}

/**
 * Anthropic互換のモデル一覧リクエストを処理する
 * @param {express.Request} req リクエスト
 * @param {express.Response} res レスポンス
 * @returns {Promise<void>}
 */
export async function handleAnthropicModels(
  _req: express.Request,
  res: express.Response,
) {
  try {
    // 利用可能なモデルを取得
    const availableModels = await modelManager.getAvailableModels()

    // Anthropic API形式に変換
    const now = Math.floor(Date.now() / 1000)
    const modelsData: ModelInfo[] = availableModels.map(model => ({
      created_at: now.toString(),
      display_name: model.name,
      id: model.id,
      type: 'model',
    }))

    // プロキシモデルIDも追加
    modelsData.push({
      created_at: now.toString(),
      display_name: 'VSCode LM Proxy',
      id: 'vscode-lm-proxy',
      type: 'model',
    })

    const anthropicModelsResponse: PageResponse<ModelInfo> = {
      data: modelsData,
      first_id: modelsData[0].id,
      has_more: false,
      last_id: modelsData[modelsData.length - 1].id,
    }

    res.json(anthropicModelsResponse)
  } catch (error: any) {
    logger.error(`Anthropic Models API error: ${error.message}`, error as Error)

    // エラーレスポンスの作成
    const statusCode = error.statusCode || 500
    const errorResponse = {
      type: 'error',
      error: {
        message: error.message || 'An unknown error has occurred',
        type: error.type || 'api_error',
      } as ErrorObject,
    }

    res.status(statusCode).json(errorResponse)
  }
}

/**
 * Anthropic互換のトークン数カウントAPIリクエストを処理する
 * @param {express.Request} req リクエスト
 * @param {express.Response} res レスポンス
 * @param {string} provider プロバイダー ('anthropic' | 'claude')
 * @returns {Promise<void>}
 */
export async function handleAnthropicCountTokens(
  req: express.Request,
  res: express.Response,
  provider: 'anthropic' | 'claude',
) {
  try {
    const body = req.body as MessageCreateParams
    logger.debug('Received count_tokens request', { body })

    // VSCodeモデル取得
    const { vsCodeModel } = await getVSCodeModel(body.model, provider)

    // 対象テキストを定義
    let inputTokens = 0

    // messages
    for (const message of body.messages) {
      // role
      inputTokens += await vsCodeModel.countTokens(message.role)

      // content
      if (typeof message.content === 'string') {
        inputTokens += await vsCodeModel.countTokens(message.content)
      } else {
        const content = message.content
          .map(part => JSON.stringify(part))
          .join(' ')
        inputTokens += await vsCodeModel.countTokens(content)
      }
    }

    // system
    if (body.system) {
      if (typeof body.system === 'string') {
        inputTokens += await vsCodeModel.countTokens(body.system)
      } else {
        const text = body.system.map(part => part.text).join(' ')
        inputTokens += await vsCodeModel.countTokens(text)
      }
    }

    // tools
    if (body.tools) {
      for (const tool of body.tools) {
        // name
        inputTokens += await vsCodeModel.countTokens(tool.name)

        // description
        if ('description' in tool && tool.description) {
          inputTokens += await vsCodeModel.countTokens(tool.description)
        }

        // input_schema
        if ('input_schema' in tool) {
          const inputSchema = JSON.stringify(tool.input_schema)
          inputTokens += await vsCodeModel.countTokens(inputSchema)
        }
      }
    }

    // レスポンスオブジェクトを作成
    const messageTokenCount: MessageTokensCount = {
      input_tokens: inputTokens,
    }
    logger.debug({ messageTokenCount })

    // レスポンス返却
    res.json(messageTokenCount)
  } catch (error) {
    const { statusCode, errorObject } = handleMessageError(
      error as vscode.LanguageModelError,
    )
    res.status(statusCode).json({ type: 'error', error: errorObject })
  }
}

/**
 * Anthropic互換の単一モデル情報リクエストを処理する
 * @param {express.Request} req リクエスト
 * @param {express.Response} res レスポンス
 * @returns {Promise<void>}
 */
export async function handleAnthropicModelInfo(
  req: express.Request,
  res: express.Response,
) {
  try {
    const modelId = req.params.model

    if (modelId === 'vscode-lm-proxy') {
      // vscode-lm-proxyの場合、固定情報を返す
      const anthropicModel: ModelInfo = {
        created_at: Math.floor(Date.now() / 1000).toString(),
        display_name: 'VSCode LM Proxy',
        id: 'vscode-lm-proxy',
        type: 'model',
      }
      res.json(anthropicModel)
      return
    }

    // LM APIからモデル情報を取得
    const vsCodeModel = await modelManager.getModelInfo(modelId)

    // モデルが存在しない場合はエラーをスロー
    if (!vsCodeModel) {
      throw {
        ...new Error(`Model ${modelId} not found`),
        statusCode: 404,
        type: 'not_found_error',
      }
    }

    // Anthropic API形式に変換
    const anthropicModel: ModelInfo = {
      created_at: Math.floor(Date.now() / 1000).toString(),
      display_name: vsCodeModel.name,
      id: vsCodeModel.id,
      type: 'model',
    }

    // レスポンスを返却
    res.json(anthropicModel)
  } catch (error: any) {
    logger.error(
      `Anthropic Model Info API error: ${error.message}`,
      error as Error,
    )

    // エラーレスポンスの作成
    const statusCode = error.statusCode || 500
    const errorResponse = {
      type: 'error',
      error: {
        message: error.message || 'An unknown error has occurred',
        type: error.type || 'api_error',
      } as ErrorObject,
    }

    res.status(statusCode).json(errorResponse)
  }
}
