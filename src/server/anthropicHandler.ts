import type { MessageCreateParams } from '@anthropic-ai/sdk/resources'
import type express from 'express'
import * as vscode from 'vscode'
import { convertAnthropicRequestToVSCodeRequest } from '../converter/anthropicConverter'
import { logger } from '../utils/logger'
import { getVSCodeModel } from './handlers'

/**
 * Anthropic互換APIのルートエンドポイントを設定する
 * @param {express.Express} app Express.jsアプリケーション
 * @returns {void}
 */
export function setupAnthropicEndpoints(app: express.Express): void {
  app.get('/anthropic', handleAnthropicRootResponse)
  app.get('/anthropic/v1', handleAnthropicRootResponse)
  app.get('/anthropic/v1/', handleAnthropicRootResponse)
}

/**
 * Anthropic互換のMessages APIエンドポイントを設定する
 * @param {express.Express} app Express.jsアプリケーション
 * @returns {void}
 */
export function setupAnthropicMessagesEndpoints(app: express.Express): void {
  // Anthropic API互換エンドポイントを登録
  app.post('/anthropic/messages', handleAnthropicMessages)
  app.post('/anthropic/v1/messages', handleAnthropicMessages)
}

/**
 * Anthropic互換のModels APIエンドポイントを設定する
 * @param {express.Express} app Express.jsアプリケーション
 * @returns {void}
 */
export function setupAnthropicModelsEndpoints(app: express.Express): void {
  // モデル一覧エンドポイント
  app.get('/anthropic/models', handleAnthropicModels)
  app.get('/anthropic/v1/models', handleAnthropicModels)

  // 特定モデル情報エンドポイント
  app.get('/anthropic/models/:model', handleAnthropicModelInfo)
  app.get('/anthropic/v1/models/:model', handleAnthropicModelInfo)
}

/**
 * Anthropic互換APIのルートエンドポイントのレスポンスを返す
 * @param {express.Request} req リクエスト
 * @param {express.Response} res レスポンス
 * @returns {void}
 */
function handleAnthropicRootResponse(
  _req: express.Request,
  res: express.Response,
) {
  res.json({ status: 'ok' })
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
async function handleAnthropicMessages(
  req: express.Request,
  res: express.Response,
) {
  try {
    const body = req.body as MessageCreateParams

    // モデル取得
    const { vsCodeModel, vsCodeModelId } = await getVSCodeModel(
      body.model,
      'anthropic',
    )

    //Anthropicリクエスト→VSCode LM API形式変換
    const { messages, options } = convertAnthropicRequestToVSCodeRequest(body)

    // キャンセラレーショントークン作成
    const cancellationToken = new vscode.CancellationTokenSource().token

    // LM APIへリクエスト送信
    const response = await vsCodeModel.sendRequest(
      messages,
      options,
      cancellationToken,
    )
    logger.info('Received response from LM API', response)
    res.json(response)
  } catch (error) {}
}

/**
 * Anthropic互換のモデル一覧リクエストを処理する
 * @param {express.Request} req リクエスト
 * @param {express.Response} res レスポンス
 * @returns {Promise<void>}
 */
async function handleAnthropicModels() {}

/**
 * Anthropic互換の単一モデル情報リクエストを処理する
 * @param {express.Request} req リクエスト
 * @param {express.Response} res レスポンス
 * @returns {Promise<void>}
 */
async function handleAnthropicModelInfo() {}

// // sample
// import Anthropic from '@anthropic-ai/sdk'

// const anthropic = new Anthropic({
//   apiKey: 'my_api_key', // defaults to process.env["ANTHROPIC_API_KEY"]
// })

// const msg = await anthropic.messages.create({
//   model: 'claude-sonnet-4-20250514',
//   max_tokens: 1024,
//   messages: [{ role: 'user', content: 'Hello, Claude' }],
// })
// console.log(msg)
