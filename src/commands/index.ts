// コマンド定義のインデックスファイル
import * as vscode from 'vscode';
import { registerServerCommands } from './server';
import { registerModelCommands } from './model';

// すべてのコマンドを登録
export function registerCommands(context: vscode.ExtensionContext): void {
  // サーバー関連のコマンドを登録
  registerServerCommands(context);
  
  // モデル選択関連のコマンドを登録
  registerModelCommands(context);
}
