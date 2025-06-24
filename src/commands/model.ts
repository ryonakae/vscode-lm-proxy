// モデル選択コマンド
import * as vscode from 'vscode';
import { modelManager } from '../model/manager';
import { statusBarManager } from '../ui/statusbar';
import { serverManager } from '../server/manager';

/**
 * モデル選択関連のコマンドを登録
 * @param context 拡張機能のコンテキスト
 */
export function registerModelCommands(context: vscode.ExtensionContext): void {
  // OpenAI APIモデル選択コマンド
  const selectOpenaiModelCommand = vscode.commands.registerCommand('vscode-lm-proxy.selectOpenaiModel', async () => {
    try {
      const openaiModelId = await modelManager.selectModel();
      
      if (openaiModelId) {
        const wasRunning = serverManager.isRunning();
        context.globalState.update('openaiModelId', openaiModelId);
        vscode.window.showInformationMessage(`OpenAI Model selected: ${openaiModelId}`);

        // ステータスバーを更新（サーバーは元の状態）
        setTimeout(() => {
          statusBarManager.updateStatus(wasRunning);
        }, 10);

        // サーバーが実行中だった場合は再起動
        if (wasRunning) {
          vscode.window.showInformationMessage('Restarting server with new model...');
          await serverManager.stop();
          // ステータスバーを停止状態に更新 (非同期でタイミングをずらす)
          setTimeout(() => {
            statusBarManager.updateStatus(false);
          }, 10);
          await serverManager.start();
          // ステータスバーを実行状態に更新 (非同期でタイミングをずらす)
          setTimeout(() => {
            statusBarManager.updateStatus(true);
          }, 10);
          vscode.window.showInformationMessage('Server restarted successfully.');
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error selecting model: ${(error as Error).message}`);
    }
  });

  // コンテキストにコマンドを登録
  context.subscriptions.push(selectOpenaiModelCommand);
  
  // 前回選択されたOpenAIモデルを復元
  const previouslySelectedOpenaiModelId = context.globalState.get<string>('openaiModelId');
  if (previouslySelectedOpenaiModelId) {
    // OpenAIモデル選択状態を復元
    modelManager.setOpenaiModelId(previouslySelectedOpenaiModelId);
    // ステータスバーも更新
    statusBarManager.updateStatus(serverManager.isRunning());
  }
}
