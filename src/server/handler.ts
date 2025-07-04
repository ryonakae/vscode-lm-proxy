// 共通ハンドラー処理

import type express from 'express'
import * as vscode from 'vscode'
import { modelManager } from '../model/manager'
import { logger } from '../utils/logger'

// モジュールスコープでglobalStateを管理
let _globalState: vscode.Memento | undefined

/**
 * globalStateを初期化する
 * @param {vscode.Memento} state VSCodeのグローバルステート
 */
export function initializeLmApiHandler(state: vscode.Memento) {
  _globalState = state
}

/**
 * サーバーのステータス確認用エンドポイントを設定します。
 * @param {express.Express} app Express.jsアプリケーション
 */
export function setupStatusEndpoint(app: express.Express): void {
  app.get('/', (_req: express.Request, res: express.Response) => {
    res.json({
      status: 'ok',
      message: 'VSCode LM API Proxy server is running',
    })
  })
}

/**
 * VSCode LM APIのモデルを取得する
 *
 * - modelIdが'vscode-lm-proxy'の場合、providerごとに選択中のモデルIDへ変換する
 * - providerが'claude'の場合、modelIdに含まれる文字列（haiku/sonnet/opus）に応じて内部モデルIDを切り替える
 * - 指定IDのモデルが見つからない場合はVSCodeのLanguageModelError形式で例外をスローする
 *
 * @param {string} modelId モデルID（'vscode-lm-proxy'の場合は選択中のモデルIDに変換）
 * @param {'openai' | 'anthropic' | 'claude' | 'gemini'} provider モデルプロバイダー種別
 * @returns {Promise<{ vsCodeModel: vscode.LanguageModelChat; vsCodeModelId: string }>} VSCodeのチャットモデルとそのID
 * @throws {vscode.LanguageModelError} モデルが見つからない場合や選択中モデルが未設定の場合
 */
export async function getVSCodeModel(
  modelId: string,
  provider: 'openai' | 'anthropic' | 'claude' | 'gemini',
): Promise<{ vsCodeModel: vscode.LanguageModelChat; vsCodeModelId: string }> {
  try {
    let selectedModelId: string | null = modelId

    // modelIdが'vscode-lm-proxy'の場合は選択中のモデルIDに変換（providerごとに分岐）
    if (modelId === 'vscode-lm-proxy') {
      if (provider === 'openai') {
        selectedModelId = modelManager.getOpenAIModelId()
      } else if (provider === 'anthropic') {
        selectedModelId = modelManager.getAnthropicModelId()
      } else if (provider === 'gemini') {
        selectedModelId = modelManager.getGeminiModelId()
      }

      if (!selectedModelId) {
        throw new Error(`No valid ${provider} model selected`)
      }
    }

    // providerが'claude'の場合は、モデルIDに含まれる文字列を元にモデルを分岐
    if (provider === 'claude') {
      if (modelId.includes('haiku')) {
        selectedModelId = modelManager.getClaudeCodeBackgroundModelId()
      } else if (modelId.includes('sonnet') || modelId.includes('opus')) {
        selectedModelId = modelManager.getClaudeCodeThinkingModelId()
      }
    }

    logger.debug('Selected model ID:', selectedModelId)

    // モデル取得
    const [vsCodeModel] = await vscode.lm.selectChatModels({
      id: selectedModelId as string,
    })
    logger.debug('Retrieved VSCode model:', { vsCodeModel })

    if (!vsCodeModel) {
      throw new Error(`Model ${selectedModelId} not found`)
    }

    // モデルが見つかった場合はそのまま返す
    return { vsCodeModel, vsCodeModelId: vsCodeModel.id }
  } catch (e: any) {
    // VSCodeのLanguageModelError形式でラップしてスロー
    const error: vscode.LanguageModelError = {
      ...new Error(e?.message || 'Unknown error'),
      name: 'NotFound',
      code: 'model_not_found',
    }
    throw error
  }
}

/**
 * VSCodeのLanguageModelTextPart型ガード
 * @param part 判定対象
 * @returns {boolean} partがLanguageModelTextPart型ならtrue
 */
export function isTextPart(
  part: unknown,
): part is vscode.LanguageModelTextPart {
  return part instanceof vscode.LanguageModelTextPart
}

/**
 * VSCodeのLanguageModelToolCallPart型ガード
 * @param part 判定対象
 * @returns {boolean} partがLanguageModelToolCallPart型ならtrue
 */
export function isToolCallPart(
  part: unknown,
): part is vscode.LanguageModelToolCallPart {
  return part instanceof vscode.LanguageModelToolCallPart
}
