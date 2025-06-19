// サーバー制御コマンド
import * as vscode from 'vscode';
import { serverManager } from '../server/manager';
import { statusBarManager } from '../ui/statusbar';

// サーバー関連のコマンドを登録
export function registerServerCommands(context: vscode.ExtensionContext): void {
  // サーバー起動コマンド
  const startServerCommand = vscode.commands.registerCommand('vscode-lm-proxy.startServer', async () => {
    try {
      await serverManager.start();
      context.globalState.update('serverRunning', true);
      vscode.commands.executeCommand('setContext', 'vscode-lm-proxy.serverRunning', true);
      // ステータスバーを更新
      statusBarManager.updateStatus(true);
      const serverUrl = serverManager.getServerUrl();
      vscode.window.showInformationMessage(`Language Model Proxyサーバーを起動しました (エンドポイント: ${serverUrl})`);
    } catch (error) {
      vscode.window.showErrorMessage(`サーバーの起動に失敗しました: ${(error as Error).message}`);
    }
  });

  // サーバー停止コマンド
  const stopServerCommand = vscode.commands.registerCommand('vscode-lm-proxy.stopServer', async () => {
    try {
      await serverManager.stop();
      context.globalState.update('serverRunning', false);
      vscode.commands.executeCommand('setContext', 'vscode-lm-proxy.serverRunning', false);
      // ステータスバーを更新
      statusBarManager.updateStatus(false);
      vscode.window.showInformationMessage('Language Model Proxyサーバーを停止しました');
    } catch (error) {
      vscode.window.showErrorMessage(`サーバーの停止に失敗しました: ${(error as Error).message}`);
    }
  });

  // コンテキストにコマンドを登録
  context.subscriptions.push(startServerCommand, stopServerCommand);
}
