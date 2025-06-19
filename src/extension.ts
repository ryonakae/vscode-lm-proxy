// VSCode拡張機能のエントリーポイント
import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { serverManager } from './server/manager';
import { statusBarManager } from './ui/statusbar';

// 拡張機能が有効化された時に実行される関数
export function activate(context: vscode.ExtensionContext) {
  console.log('LM Proxy拡張機能が有効化されました');

  // コンテキスト変数の初期化
  vscode.commands.executeCommand('setContext', 'vscode-lm-proxy.serverRunning', false);
  
  // ステータスバーの初期化
  statusBarManager.initialize(context);

  // コマンドの登録
  registerCommands(context);

  // 状態復元
  // 以前サーバーが実行中だった場合は自動的に再起動
  const wasServerRunning = context.globalState.get<boolean>('serverRunning', false);
  if (wasServerRunning) {
    serverManager.start()
      .then(() => {
        const serverUrl = serverManager.getServerUrl();
        vscode.window.showInformationMessage(`Language Model Proxyサーバーを起動しました (エンドポイント: ${serverUrl})`);
      })
      .catch(err => {
        vscode.window.showErrorMessage(`サーバーの自動起動に失敗しました: ${err.message}`);
      });
  }
}

// 拡張機能が無効化された時に実行される関数
export function deactivate(): Promise<void> | undefined {
  console.log('LM Proxy拡張機能が無効化されました');
  
  // サーバーが実行中なら停止
  if (serverManager.isRunning()) {
    return serverManager.stop();
  }
  
  return undefined;
}
