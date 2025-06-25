// VSCode拡張機能のエントリーポイント
import * as vscode from 'vscode'
import { registerCommands } from '@/commands'
import { initializeLmApiHandler } from '@/server/handlers'
import { serverManager } from '@/server/manager'
import { statusBarManager } from '@/ui/statusbar'
import { logger } from '@/utils/logger'

// グローバルコンテキストの保存用変数
let globalExtensionContext: vscode.ExtensionContext

// グローバルモデルマネージャー変数
let modelManager: any

// モデルマネージャーを取得する関数をエクスポート
/**
 * モデルマネージャーのインスタンスを取得します。
 * @returns {any} モデルマネージャーのインスタンス
 */
export function getModelManager() {
  return modelManager
}

/**
 * VSCode拡張機能が有効化された際に呼び出されるエントリーポイントです。
 * グローバル変数や各種マネージャーの初期化、コマンド登録、設定監視、サーバー自動起動などを行います。
 * @param {vscode.ExtensionContext} context 拡張機能のグローバルコンテキスト
 */
export function activate(context: vscode.ExtensionContext) {
  // グローバル変数にコンテキストを保存
  globalExtensionContext = context

  // モデル管理クラスのインポートと初期化（グローバル変数に格納）
  // activate内でrequireすることで循環依存を回避
  modelManager = require('./model/manager').modelManager

  // モデルマネージャーにExtensionContextを設定
  // これにより内部で保存されたモデル情報が復元される
  modelManager.setExtensionContext(context)

  // LmApiHandlerにグローバル状態をセット
  // VSCodeのグローバルストレージをAPIハンドラで利用可能にする
  initializeLmApiHandler(context.globalState)

  // 選択中のOpenAIモデルとサーバー状態をログに出力
  const openaiModel = modelManager.getOpenAIModelId() || 'Not selected'
  const serverStatus = serverManager.isRunning() ? 'Running' : 'Stopped'
  logger.info(
    `LM Proxy extension activated (Model: ${openaiModel}, Server: ${serverStatus})`,
  )

  // 設定に応じて出力パネルを表示
  const config = vscode.workspace.getConfiguration('vscode-lm-proxy')
  const showOnStartup = config.get<boolean>('showOutputOnStartup', true)
  if (showOnStartup) {
    logger.show(true) // フォーカスは現在のエディタに保持
  }

  // コンテキスト変数の初期化
  vscode.commands.executeCommand(
    'setContext',
    'vscode-lm-proxy.serverRunning',
    false,
  )

  // ステータスバーの初期化
  statusBarManager.initialize(context)

  // コマンドの登録
  registerCommands(context)

  // 設定変更の監視
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      // ポート番号変更時、サーバーが起動中なら再起動を促す
      if (
        e.affectsConfiguration('vscode-lm-proxy.port') &&
        serverManager.isRunning()
      ) {
        vscode.window.showInformationMessage(
          'Port number setting has been changed. Please restart the server to apply the change.',
        )
      }
    }),
  )

  // 状態復元
  // 以前サーバーが実行中だった場合は自動的に再起動
  const wasServerRunning = context.globalState.get<boolean>(
    'serverRunning',
    false,
  )
  if (wasServerRunning) {
    serverManager
      .start()
      .then(() => {
        const serverUrl = serverManager.getServerUrl()
        vscode.window.showInformationMessage(
          `Language Model Proxy server started (${serverUrl})`,
        )
      })
      .catch(err => {
        vscode.window.showErrorMessage(
          `Failed to auto-start server: ${err.message}`,
        )
      })
  }
}

/**
 * VSCode拡張機能が無効化された際に呼び出されるクリーンアップ関数です。
 * モデル情報やサーバー状態の保存、サーバー停止処理を行います。
 * @returns {Promise<void> | undefined} サーバー停止時はPromise、不要な場合はundefined
 */
export function deactivate(): Promise<void> | undefined {
  logger.info('LM Proxy extension deactivated')

  // OpenAIモデル情報を保存（グローバル変数に格納されているモデルマネージャーを使用）
  const openaiModelId = modelManager.getOpenAIModelId()

  // グローバル状態へOpenAIモデル情報と実行状態を保存
  globalExtensionContext.globalState.update('openaiModelId', openaiModelId)
  globalExtensionContext.globalState.update(
    'serverRunning',
    serverManager.isRunning(),
  )

  // サーバーが実行中なら停止
  if (serverManager.isRunning()) {
    return serverManager.stop()
  }

  return undefined
}
