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
        context.globalState.update('selectedModel', selectedModel);
        vscode.window.showInformationMessage(`モデルを選択しました: ${selectedModel}`);
        // ステータスバーを更新
        statusBarManager.updateStatus(serverManager.isRunning());
      } else {
        vscode.window.showWarningMessage('モデルが選択されませんでした');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`モデルの選択中にエラーが発生しました: ${(error as Error).message}`);
    }
  });

  // コンテキストにコマンドを登録
  context.subscriptions.push(selectModelCommand);
  
  // 前回選択されたモデルを復元
  const previouslySelectedModel = context.globalState.get<string>('selectedModel');
  if (previouslySelectedModel) {
    // モデル選択状態を復元
    modelManager.setSelectedModel(previouslySelectedModel);
    console.log(`前回選択されたモデルを復元しました: ${previouslySelectedModel}`);
    // ステータスバーも更新
    statusBarManager.updateStatus(serverManager.isRunning());
  }
}
