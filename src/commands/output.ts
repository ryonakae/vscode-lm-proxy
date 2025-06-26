// 出力パネル関連のコマンド
import * as vscode from 'vscode'
import { logger } from '../utils/logger'

/**
 * 出力パネル関連のコマンド（表示・クリア・ログレベル変更）をVSCodeに登録します。
 * @param {vscode.ExtensionContext} context 拡張機能のグローバルコンテキスト
 */
export function registerOutputCommands(context: vscode.ExtensionContext): void {
  // 出力パネルを表示するコマンド
  const showOutputCommand = vscode.commands.registerCommand(
    'vscode-lm-proxy.showOutput',
    () => {
      logger.show(false) // フォーカスを出力パネルに移す
      logger.info('Output panel displayed')
    },
  )

  // 出力パネルをクリアするコマンド
  const clearOutputCommand = vscode.commands.registerCommand(
    'vscode-lm-proxy.clearOutput',
    () => {
      logger.clear()
      logger.info('Output panel cleared')
    },
  )

  // DEBUGレベルに設定するコマンド
  const setDebugLevelCommand = vscode.commands.registerCommand(
    'vscode-lm-proxy.setDebugLogLevel',
    async () => {
      const config = vscode.workspace.getConfiguration('vscode-lm-proxy')
      await config.update('logLevel', 0, vscode.ConfigurationTarget.Global)
      logger.info(
        'Log level set to DEBUG. Detailed request/response logs will be shown.',
      )
      logger.show(false)
    },
  )

  // INFOレベルに設定するコマンド
  const setInfoLevelCommand = vscode.commands.registerCommand(
    'vscode-lm-proxy.setInfoLogLevel',
    async () => {
      const config = vscode.workspace.getConfiguration('vscode-lm-proxy')
      await config.update('logLevel', 1, vscode.ConfigurationTarget.Global)
      logger.info(
        'Log level set to INFO. Basic request/response logs will be shown.',
      )
      logger.show(false)
    },
  )

  // コンテキストに登録
  context.subscriptions.push(
    showOutputCommand,
    clearOutputCommand,
    setDebugLevelCommand,
    setInfoLevelCommand,
  )
}
