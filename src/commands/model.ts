// モデル選択コマンド
import * as vscode from 'vscode'
import { modelManager } from '../model/manager'
import { serverManager } from '../server/manager'
import { statusBarManager } from '../ui/statusbar'

/**
 * モデル選択関連のコマンド（選択・再起動）をVSCodeに登録します。
 * @param {vscode.ExtensionContext} context 拡張機能のグローバルコンテキスト
 */
export function registerModelCommands(context: vscode.ExtensionContext): void {
  // OpenAI APIモデル選択コマンド
  const selectOpenAIModelCommand = vscode.commands.registerCommand(
    'vscode-lm-proxy.selectOpenAIModel',
    async () => {
      try {
        // モデル選択ダイアログを表示
        const openaiModelId = await modelManager.selectModel('openAI')

        if (openaiModelId) {
          // モデルIDを設定
          context.globalState.update('openaiModelId', openaiModelId)
          vscode.window.showInformationMessage(
            `OpenAI Model selected: ${openaiModelId}`,
          )
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error selecting model: ${(error as Error).message}`,
        )
      }
    },
  )

  // Anthropicモデル選択コマンド
  const selectAnthropicModelCommand = vscode.commands.registerCommand(
    'vscode-lm-proxy.selectAnthropicModel',
    async () => {
      try {
        // モデル選択ダイアログを表示
        const anthropicModelId = await modelManager.selectModel('anthropic')

        if (anthropicModelId) {
          // モデルIDを設定
          context.globalState.update('anthropicModelId', anthropicModelId)
          vscode.window.showInformationMessage(
            `Anthropic Model selected: ${anthropicModelId}`,
          )
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error selecting Anthropic model: ${(error as Error).message}`,
        )
      }
    },
  )

  // コンテキストにコマンドを登録
  context.subscriptions.push(
    selectOpenAIModelCommand,
    selectAnthropicModelCommand,
  )

  // 前回選択されたOpenAIモデルを復元
  const previouslySelectedOpenAIModelId =
    context.globalState.get<string>('openaiModelId')
  if (previouslySelectedOpenAIModelId) {
    // モデル選択状態を復元
    modelManager.setOpenAIModelId(previouslySelectedOpenAIModelId)
    // ステータスバーも更新
    statusBarManager.updateStatus(serverManager.isRunning())
  }

  // 前回選択されたAnthropicモデルを復元
  const previouslySelectedAnthropicModelId =
    context.globalState.get<string>('anthropicModelId')
  if (previouslySelectedAnthropicModelId) {
    // モデル選択状態を復元
    modelManager.setAnthropicModelId(previouslySelectedAnthropicModelId)
    // ステータスバーも更新
    statusBarManager.updateStatus(serverManager.isRunning())
  }
}
