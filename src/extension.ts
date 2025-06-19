// VSCode拡張機能のエントリーポイント
import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { serverManager } from './server/manager';
import { statusBarManager } from './ui/statusbar';

// 拡張機能が有効化された時に実行される関数
export function activate(context: vscode.ExtensionContext) {
  console.log('LM Proxy extension activated');

  // コンテキスト変数の初期化
  vscode.commands.executeCommand('setContext', 'vscode-lm-proxy.serverRunning', false);
  
  // ステータスバーの初期化
  statusBarManager.initialize(context);

  // コマンドの登録
  registerCommands(context);
  
  // 設定変更の監視
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('vscode-lm-proxy.port') && serverManager.isRunning()) {
        vscode.window.showInformationMessage(
          'ポート番号の設定が変更されました。変更を反映するにはサーバーを再起動してください。'
        );
      }
    })
  );

  // 状態復元
  // 以前サーバーが実行中だった場合は自動的に再起動
  const wasServerRunning = context.globalState.get<boolean>('serverRunning', false);
  if (wasServerRunning) {
    serverManager.start()
      .then(() => {
        const serverUrl = serverManager.getServerUrl();
        vscode.window.showInformationMessage(`Language Model Proxy server started (endpoint: ${serverUrl})`);
      })
      .catch(err => {
        vscode.window.showErrorMessage(`Failed to auto-start server: ${err.message}`);
      });
  }
}

// 拡張機能が無効化された時に実行される関数
export function deactivate(): Promise<void> | undefined {
  console.log('LM Proxy extension deactivated');
  
  // サーバーが実行中なら停止
  if (serverManager.isRunning()) {
    return serverManager.stop();
  }
  
  return undefined;
}
