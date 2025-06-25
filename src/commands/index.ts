// コマンド定義のインデックスファイル
import * as vscode from 'vscode';
import { registerServerCommands } from './server';
import { registerModelCommands } from './model';
import { registerOutputCommands } from './output';

/**
 * 拡張機能で利用する全コマンドを一括登録します。
 * @param {vscode.ExtensionContext} context 拡張機能のグローバルコンテキスト
 */
export function registerCommands(context: vscode.ExtensionContext): void {
  // サーバー関連のコマンドを登録
  registerServerCommands(context);
  
  // モデル選択関連のコマンドを登録
  registerModelCommands(context);
  
  // 出力パネル関連のコマンドを登録
  registerOutputCommands(context);
}
