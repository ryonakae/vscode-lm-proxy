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
        const selectedModelName = modelManager.getSelectedModelName();
        context.globalState.update('selectedModel', selectedModel);
        context.globalState.update('selectedModelName', selectedModelName);
        vscode.window.showInformationMessage(`Model selected: ${selectedModelName || selectedModel}`);
        // ステータスバーを更新
        statusBarManager.updateStatus(serverManager.isRunning());
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
    console.log(`前回選択されたモデルを復元しました: ${previouslySelectedModelName || previouslySelectedModel}`);
    // ステータスバーも更新
    statusBarManager.updateStatus(serverManager.isRunning());
  }
}
