// コマンド定義のインデックスファイル
import type * as vscode from 'vscode'
import { registerModelCommands } from '@/commands/model'
import { registerOutputCommands } from '@/commands/output'
import { registerServerCommands } from '@/commands/server'

/**
 * 拡張機能で利用する全コマンドを一括登録します。
 * @param {vscode.ExtensionContext} context 拡張機能のグローバルコンテキスト
 */
export function registerCommands(context: vscode.ExtensionContext): void {
  // サーバー関連のコマンドを登録
  registerServerCommands(context)

  // モデル選択関連のコマンドを登録
  registerModelCommands(context)

  // 出力パネル関連のコマンドを登録
  registerOutputCommands(context)
}
