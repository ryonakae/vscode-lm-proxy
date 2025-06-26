// 共通ハンドラー処理

import type express from 'express'
import type * as vscode from 'vscode'

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
