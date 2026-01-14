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
 * VSCode LM APIのモデルを取得する（'vscode-lm-proxy'時は選択中のOpenAIモデルに変換）
 * @param {OpenAI.ChatCompletionCreateParams} body
 * @returns {Promise<{ model: any, modelId: string }>}
 * @throws エラー時は例外をスロー
 */
export async function getVSCodeModel(
  modelId: string,
  provider: 'openai' | 'anthropic' | 'claude',
): Promise<{ vsCodeModel: vscode.LanguageModelChat; vsCodeModelId: string }> {
  try {
    let selectedModelId: string | null = modelId

    // modelIdが'vscode-lm-proxy'の場合は選択中のモデルIDに変換（providerごとに分岐）
    if (modelId === 'vscode-lm-proxy') {
      if (provider === 'openai') {
        selectedModelId = modelManager.getOpenAIModelId()
      } else if (provider === 'anthropic') {
        selectedModelId = modelManager.getAnthropicModelId()
      } else if (provider === 'claude') {
        selectedModelId = modelManager.getClaudeCodeBackgroundModelId()
      }

      if (!selectedModelId) {
        throw new Error(`No valid ${provider} model selected`)
      }
    }

    // providerが'claude'の場合は、モデルIDに含まれる文字列を元にモデルを分岐
    if (provider === 'claude' && modelId !== 'vscode-lm-proxy') {
      if (modelId.includes('haiku')) {
        const backgroundModel = modelManager.getClaudeCodeBackgroundModelId()
        if (backgroundModel) {
          selectedModelId = backgroundModel
        }
      } else if (modelId.includes('sonnet') || modelId.includes('opus')) {
        const thinkingModel = modelManager.getClaudeCodeThinkingModelId()
        if (thinkingModel) {
          selectedModelId = thinkingModel
        }
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
