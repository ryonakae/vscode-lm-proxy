// Gemini互換のAPIエンドポイントを実装

import { ApiError, type ListModelsResponse, type Model } from '@google/genai'
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
 * Gemini互換のAPIエンドポイントを設定する
 * @param {express.Express} app Express.jsアプリケーション
 * @returns {void}
 */
export function setupGeminiEndpoints(app: express.Express): void {
  // コンテンツ生成
  app.post(
    '/gemini/v1beta/:model\\:generateContent',
    handleGeminiGenerateContent,
  )

  // // コンテンツ生成 (ストリーミング)
  // app.post(
  //   '/gemini/v1beta/:model\\:streamGenerateContent',
  //   handleGeminiStreamGenerateContent,
  // )

  // モデル一覧
  app.get('/gemini/v1beta/models', handleGeminiModels)

  // 特定モデル情報
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
    // 利用可能なモデルを取得
    const availableModels = await modelManager.getAvailableModels()

    const modelsData: Model[] = availableModels.map(model => ({
      name: `models/${model.id}`,
      version: model.version.startsWith(`${model.id}-`)
        ? model.version.replace(`${model.id}-`, '')
        : model.version,
      displayName: model.name,
      inputTokenLimit: model.maxInputTokens,
      supportedActions: ['generateContent', 'countTokens'],
    }))

    // プロキシモデルも追加
    modelsData.push({
      name: 'models/vscode-lm-proxy',
      version: '1.0',
      displayName: 'VSCode LM Proxy',
      supportedActions: ['generateContent', 'countTokens'],
    })

    const geminiModelsResponse: ListModelsResponse = {
      models: modelsData,
    }

    res.json(geminiModelsResponse)
  } catch (error: any) {
    logger.error(`Gemini Models API error: ${error.message}`, error as Error)

    // エラーレスポンスの作成
    const statusCode = error.statusCode || 500
    const errorResponse = new ApiError({
      status: statusCode,
      message: error.message || 'An unknown error has occurred',
    })

    res.status(statusCode).json(errorResponse)
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
    const modelId = req.params.model

    if (modelId === 'vscode-lm-proxy') {
      // vscode-lm-proxyの場合、固定情報を返す
      const geminiModel: Model = {
        name: 'models/vscode-lm-proxy',
        version: '1.0',
        displayName: 'VSCode LM Proxy',
        supportedActions: ['generateContent', 'countTokens'],
      }
      res.json(geminiModel)
      return
    }

    // LM APIからモデル情報を取得
    const vsCodeModel = await modelManager.getModelInfo(modelId)

    if (!vsCodeModel) {
      // モデルが存在しない場合はエラーをスロー
      throw {
        ...new Error(`Model ${modelId} not found`),
        statusCode: 404,
        type: 'not_found_error',
      }
    }

    // Gemini互換のモデル情報形式に変換
    const geminiModel: Model = {
      name: `models/${vsCodeModel.id}`,
      version: vsCodeModel.version.startsWith(`${vsCodeModel.id}-`)
        ? vsCodeModel.version.replace(`${vsCodeModel.id}-`, '')
        : vsCodeModel.version,
      displayName: vsCodeModel.name,
      inputTokenLimit: vsCodeModel.maxInputTokens,
      supportedActions: ['generateContent', 'countTokens'],
    }

    // レスポンスを返す
    res.json(geminiModel)
  } catch (error: any) {
    logger.error(
      `Gemini Model Info API error: ${error.message}`,
      error as Error,
    )

    // エラーレスポンスの作成
    const statusCode = error.statusCode || 500
    const errorResponse = new ApiError({
      status: statusCode,
      message: error.message || 'An unknown error has occurred',
    })

    res.status(statusCode).json(errorResponse)
  }
}
