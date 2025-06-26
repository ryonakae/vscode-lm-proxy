// 共通ハンドラー処理

import type express from 'express'
import * as vscode from 'vscode'
import { modelManager } from '../model/manager'

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
  provider: 'openai' | 'anthropic',
): Promise<{ vsCodeModel: vscode.LanguageModelChat; vsCodeModelId: string }> {
  let vsCodeModelId = modelId

  // 'vscode-lm-proxy'の場合は選択中のモデルIDに変換（providerごとに分岐）
  if (vsCodeModelId === 'vscode-lm-proxy') {
    let selectedModelId: string | null = null

    if (provider === 'openai') {
      selectedModelId = modelManager.getOpenAIModelId()
    } else if (provider === 'anthropic') {
      selectedModelId = modelManager.getAnthropicModelId?.()
    }

    if (!selectedModelId) {
      const error: vscode.LanguageModelError = {
        ...new Error(
          `No valid ${provider} model selected. Please select a model first.`,
        ),
        name: 'NotFound',
        code: 'model_not_found',
      }
      throw error
    }

    vsCodeModelId = selectedModelId
  }

  // モデル取得
  const [vsCodeModel] = await vscode.lm.selectChatModels({ id: vsCodeModelId })

  // モデルが見つからない場合はエラーをスロー
  if (!vsCodeModel) {
    const error: vscode.LanguageModelError = {
      ...new Error(`Model ${vsCodeModelId} not found`),
      name: 'NotFound',
      code: 'model_not_found',
    }
    throw error
  }

  // モデルが見つかった場合はそのまま返す
  return { vsCodeModel, vsCodeModelId }
}
