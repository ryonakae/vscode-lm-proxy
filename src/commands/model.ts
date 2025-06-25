// モデル選択コマンド
import * as vscode from 'vscode'
import { modelManager } from '@/model/manager'
import { serverManager } from '@/server/manager'
import { statusBarManager } from '@/ui/statusbar'

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
        const openaiModelId = await modelManager.selectModel()

        if (openaiModelId) {
          // サーバーの実行状態を記録
          const wasRunning = serverManager.isRunning()
          context.globalState.update('openaiModelId', openaiModelId)
          vscode.window.showInformationMessage(
            `OpenAI Model selected: ${openaiModelId}`,
          )

          // ステータスバーを更新（サーバーは元の状態）
          setTimeout(() => {
            statusBarManager.updateStatus(wasRunning)
          }, 10)

          // サーバーが実行中だった場合は再起動
          // モデル変更後にサーバーを再起動しないとAPIリクエストが新モデルに反映されないため
          if (wasRunning) {
            vscode.window.showInformationMessage(
              'Restarting server with new model...',
            )
            await serverManager.stop()
            // ステータスバーを停止状態に更新 (非同期でタイミングをずらす)
            setTimeout(() => {
              statusBarManager.updateStatus(false)
            }, 10)
            await serverManager.start()
            // ステータスバーを実行状態に更新 (非同期でタイミングをずらす)
            setTimeout(() => {
              statusBarManager.updateStatus(true)
            }, 10)
            vscode.window.showInformationMessage(
              'Server restarted successfully.',
            )
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error selecting model: ${(error as Error).message}`,
        )
      }
    },
  )

  // コンテキストにコマンドを登録
  context.subscriptions.push(selectOpenAIModelCommand)

  // 前回選択されたOpenAIモデルを復元
  const previouslySelectedOpenAIModelId =
    context.globalState.get<string>('openaiModelId')
  if (previouslySelectedOpenAIModelId) {
    // OpenAIモデル選択状態を復元
    modelManager.setOpenAIModelId(previouslySelectedOpenAIModelId)
    // ステータスバーも更新
    statusBarManager.updateStatus(serverManager.isRunning())
  }
}
