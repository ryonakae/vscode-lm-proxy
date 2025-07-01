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

  // ログレベルをQuickPickで選択して設定するコマンド
  const setLogLevelCommand = vscode.commands.registerCommand(
    'vscode-lm-proxy.setLogLevel',
    async () => {
      const config = vscode.workspace.getConfiguration('vscode-lm-proxy')
      const logLevels = [
        {
          label: 'DEBUG',
          description: 'Show detailed request/response logs',
          value: 0,
        },
        {
          label: 'INFO',
          description: 'Show basic request/response logs',
          value: 1,
        },
        {
          label: 'WARN',
          description: 'Show only warnings and errors',
          value: 2,
        },
        { label: 'ERROR', description: 'Show only errors', value: 3 },
      ]
      const selected = await vscode.window.showQuickPick(logLevels, {
        placeHolder: 'Select log level',
      })
      if (selected) {
        await config.update(
          'logLevel',
          selected.value,
          vscode.ConfigurationTarget.Global,
        )
        logger.show(false)
      }
    },
  )

  // コンテキストに登録
  context.subscriptions.push(
    showOutputCommand,
    clearOutputCommand,
    setLogLevelCommand,
  )
}
