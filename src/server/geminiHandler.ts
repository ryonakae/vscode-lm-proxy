// Gemini互換のAPIエンドポイントを実装
import type express from 'express'
import * as vscode from 'vscode'
import {
  convertGeminiRequestToVSCodeRequest,
  convertVSCodeResponseToGeminiResponse,
} from '../converter/geminiConverter'
import { modelManager } from '../model/manager'
import { logger } from '../utils/logger'
import { getVSCodeModel } from './handler'

/**
 * Gemini互換のGenerateContent APIエンドポイントを設定する
 * @param {express.Express} app Express.jsアプリケーション
 * @returns {void}
 */
export function setupGeminiGenerateContentEndpoints(
  app: express.Express,
): void {
  // Gemini API互換エンドポイント
  // 公式形式: https://generativelanguage.googleapis.com/v1beta/{model=models/*}:generateContent
  app.post(
    '/gemini/v1beta/:model\\:generateContent',
    handleGeminiGenerateContent,
  )
  app.post(
    '/gemini/v1beta/models/:model\\:generateContent',
    handleGeminiGenerateContent,
  )

  // // ストリーミングバージョン
  // app.post(
  //   '/gemini/v1beta/:model\\:streamGenerateContent',
  //   handleGeminiStreamGenerateContent,
  // )
  // app.post(
  //   '/gemini/v1beta/models/:model\\:streamGenerateContent',
  //   handleGeminiStreamGenerateContent,
  // )
}

/**
 * Gemini互換のModels APIエンドポイントを設定する
 * @param {express.Express} app Express.jsアプリケーション
 * @returns {void}
 */
export function setupGeminiModelsEndpoints(app: express.Express): void {
  // モデル一覧エンドポイント
  // 公式形式: https://generativelanguage.googleapis.com/v1beta/models
  app.get('/gemini/v1beta/models', handleGeminiModels)

  // 特定モデル情報エンドポイント
  // 公式形式: https://generativelanguage.googleapis.com/v1beta/{name=models/*}
  app.get('/gemini/v1beta/models/:model', handleGeminiModelInfo)
}

/**
 * Gemini互換のGenerateContent APIリクエストを処理するメイン関数。
 * - リクエストバリデーション
 * - モデル取得
 * - LM APIへのリクエスト送信
 * - ストリーミング/非ストリーミングレスポンス処理
 * - エラーハンドリング
 * @param {express.Request} req リクエスト
 * @param {express.Response} res レスポンス
 * @returns {Promise<void>}
 */
async function handleGeminiGenerateContent(
  req: express.Request,
  res: express.Response,
) {
  try {
    const body = req.body
    logger.debug('Received gemini request', { body })

    // // 必須フィールドのバリデーション
    // validateGenerateContentRequest(body)

    // モデル取得
    const { vsCodeModel } = await getVSCodeModel(body.model, 'anthropic')

    // // ストリーミングモード判定
    // const isStreaming = body.stream === true

    //Geminiリクエスト→VSCode LM API形式変換
    const { messages, options, inputTokens } =
      await convertGeminiRequestToVSCodeRequest(body, vsCodeModel)

    res.json({})
  } catch (error) {
    // エラー処理
    const statusCode = 500
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    res.status(statusCode).json({
      error: {
        message: errorMessage,
      },
    })
  }
}

/**
 * GenerateContent APIリクエストの必須フィールドをバリデーションする
 * @param {any} body
 * @throws エラー時は例外をスロー
 */
function validateGenerateContentRequest(body: any) {
  // TODO: 実際のバリデーションロジックを実装する
  if (!body.model) {
    throw new Error('The model field is required')
  }
}

/**
 * Gemini互換のモデル一覧リクエストを処理する
 * @param {express.Request} req リクエスト
 * @param {express.Response} res レスポンス
 * @returns {Promise<void>}
 */
async function handleGeminiModels(
  _req: express.Request,
  res: express.Response,
) {
  try {
    // TODO: 実際の処理を実装する
    res.status(501).json({
      error: {
        message: 'Not implemented yet',
      },
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        message: error.message || 'Unknown error',
      },
    })
  }
}

/**
 * Gemini互換の単一モデル情報リクエストを処理する
 * @param {express.Request} req リクエスト
 * @param {express.Response} res レスポンス
 * @returns {Promise<void>}
 */
async function handleGeminiModelInfo(
  req: express.Request,
  res: express.Response,
) {
  try {
    // TODO: 実際の処理を実装する
    res.status(501).json({
      error: {
        message: 'Not implemented yet',
      },
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        message: error.message || 'Unknown error',
      },
    })
  }
}
