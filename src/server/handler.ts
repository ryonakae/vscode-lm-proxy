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
  provider: 'openai' | 'anthropic' | 'claude-code',
): Promise<{ vsCodeModel: vscode.LanguageModelChat; vsCodeModelId: string }> {
  let vsCodeModelId = modelId

  // 'vscode-lm-proxy'の場合は選択中のモデルIDに変換（providerごとに分岐）
  if (vsCodeModelId === 'vscode-lm-proxy') {
    let selectedModelId: string | null = null

    if (provider === 'openai') {
      selectedModelId = modelManager.getOpenAIModelId()
    } else if (provider === 'anthropic') {
      selectedModelId = modelManager.getAnthropicModelId()
    } else if (provider === 'claude-code') {
      if (vsCodeModelId.includes('haiku')) {
        selectedModelId = modelManager.getClaudeCodeBackgroundModelId()
      } else if (
        vsCodeModelId.includes('sonnet') ||
        vsCodeModelId.includes('opus')
      ) {
        selectedModelId = modelManager.getClaudeCodeThinkingModelId()
      }
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
