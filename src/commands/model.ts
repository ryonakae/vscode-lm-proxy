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
  // モデル選択コマンド
  const selectModelCommand = vscode.commands.registerCommand('vscode-lm-proxy.selectModel', async () => {
    try {
      const selectedModel = await modelManager.selectModel();
      
      if (selectedModel) {
        const wasRunning = serverManager.isRunning();
        const selectedModelName = modelManager.getSelectedModelName();
        context.globalState.update('selectedModel', selectedModel);
        context.globalState.update('selectedModelName', selectedModelName);
        vscode.window.showInformationMessage(`Model selected: ${selectedModelName || selectedModel}`);

        // ステータスバーを更新 (新しいモデル名で、サーバーは元の状態)
        // 非同期でタイミングをずらして確実に更新を反映
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
  context.subscriptions.push(selectModelCommand);
  
  // 前回選択されたモデルを復元
  const previouslySelectedModel = context.globalState.get<string>('selectedModel');
  const previouslySelectedModelName = context.globalState.get<string>('selectedModelName');
  if (previouslySelectedModel) {
    // モデル選択状態を復元
    modelManager.setSelectedModel(previouslySelectedModel, previouslySelectedModelName || undefined);
    console.log(`Restored previously selected model: ${previouslySelectedModelName || previouslySelectedModel}`);
    // ステータスバーも更新
    statusBarManager.updateStatus(serverManager.isRunning());
  }
}
