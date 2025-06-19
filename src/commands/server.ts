// サーバー制御コマンド
import * as vscode from 'vscode';
import { serverManager } from '../server/manager';

// サーバー関連のコマンドを登録
export function registerServerCommands(context: vscode.ExtensionContext): void {
  // サーバー起動コマンド
  const startServerCommand = vscode.commands.registerCommand('vscode-lm-proxy.startServer', async () => {
    try {
      await serverManager.start();
      context.globalState.update('serverRunning', true);
      vscode.window.showInformationMessage('Language Model Proxyサーバーを起動しました');
    } catch (error) {
      vscode.window.showErrorMessage(`サーバーの起動に失敗しました: ${(error as Error).message}`);
    }
  });

  // サーバー停止コマンド
  const stopServerCommand = vscode.commands.registerCommand('vscode-lm-proxy.stopServer', async () => {
    try {
      await serverManager.stop();
      context.globalState.update('serverRunning', false);
      vscode.window.showInformationMessage('Language Model Proxyサーバーを停止しました');
    } catch (error) {
      vscode.window.showErrorMessage(`サーバーの停止に失敗しました: ${(error as Error).message}`);
    }
  });

  // コンテキストにコマンドを登録
  context.subscriptions.push(startServerCommand, stopServerCommand);
}
