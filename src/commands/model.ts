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
        context.globalState.update('selectedModelId', selectedModel);
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

  // OpenAI API用モデル設定コマンド
  const configureOpenaiModelCommand = vscode.commands.registerCommand('vscode-lm-proxy.configureOpenaiModel', async () => {
    try {
      const availableModels = await modelManager.getAvailableModels();
      
      // モデル選択肢を作成（現在選択中のモデル + 利用可能なモデル）
      const quickPickItems = availableModels.map(model => ({
        label: model.name,
        description: `${model.id}`,
        id: model.id
      }));
      
      // プロキシモデルを追加
      quickPickItems.unshift({
        label: 'Use current selected model',
        description: 'vscode-lm-proxy',
        id: 'vscode-lm-proxy'
      });
      
      const currentConfig = vscode.workspace.getConfiguration('vscode-lm-proxy');
      const currentModelId = currentConfig.get<string>('openaiModel') || 'vscode-lm-proxy';
      
      const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: 'Select model for OpenAI API endpoints',
        title: 'Configure OpenAI API Model'
      });
      
      if (selectedItem) {
        await currentConfig.update('openaiModel', selectedItem.id, true);
        vscode.window.showInformationMessage(
          `OpenAI API model set to: ${selectedItem.label} (${selectedItem.id})`
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error configuring OpenAI model: ${(error as Error).message}`);
    }
  });

  // Anthropic API用モデル設定コマンド
  const configureAnthropicModelCommand = vscode.commands.registerCommand('vscode-lm-proxy.configureAnthropicModel', async () => {
    try {
      const availableModels = await modelManager.getAvailableModels();
      
      // モデル選択肢を作成（現在選択中のモデル + 利用可能なモデル）
      const quickPickItems = availableModels.map(model => ({
        label: model.name,
        description: `${model.id}`,
        id: model.id
      }));
      
      // プロキシモデルを追加
      quickPickItems.unshift({
        label: 'Use current selected model',
        description: 'vscode-lm-proxy',
        id: 'vscode-lm-proxy'
      });
      
      const currentConfig = vscode.workspace.getConfiguration('vscode-lm-proxy');
      const currentModelId = currentConfig.get<string>('anthropicModel') || 'vscode-lm-proxy';
      
      const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: 'Select model for Anthropic API endpoints',
        title: 'Configure Anthropic API Model'
      });
      
      if (selectedItem) {
        await currentConfig.update('anthropicModel', selectedItem.id, true);
        vscode.window.showInformationMessage(
          `Anthropic API model set to: ${selectedItem.label} (${selectedItem.id})`
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error configuring Anthropic model: ${(error as Error).message}`);
    }
  });

  // Claude Code用モデル設定コマンド
  const configureClaudeCodeModelsCommand = vscode.commands.registerCommand('vscode-lm-proxy.configureClaudeCodeModels', async () => {
    try {
      const availableModels = await modelManager.getAvailableModels();
      
      // モデル選択肢を作成（現在選択中のモデル + 利用可能なモデル）
      const modelOptions = availableModels.map(model => ({
        label: model.name,
        description: `${model.id}`,
        id: model.id
      }));
      
      // プロキシモデルを追加
      modelOptions.unshift({
        label: 'Use current selected model',
        description: 'vscode-lm-proxy',
        id: 'vscode-lm-proxy'
      });
      
      const currentConfig = vscode.workspace.getConfiguration('vscode-lm-proxy');
      
      // バックグラウンドモデル設定
      const currentBackgroundId = currentConfig.get<string>('claudeBackgroundModel') || 'vscode-lm-proxy';
      const backgroundItem = await vscode.window.showQuickPick(modelOptions, {
        placeHolder: 'Select model for Claude Code background tasks (haiku)',
        title: 'Configure Claude Code Background Model'
      });
      
      if (!backgroundItem) {
        return; // キャンセルされた
      }
      
      // シンクモデル設定
      const currentThinkId = currentConfig.get<string>('claudeThinkModel') || 'vscode-lm-proxy';
      const thinkItem = await vscode.window.showQuickPick(modelOptions, {
        placeHolder: 'Select model for Claude Code think tasks (sonnet)',
        title: 'Configure Claude Code Think Model'
      });
      
      if (!thinkItem) {
        return; // キャンセルされた
      }
      
      // 両方のモデルが選択されたら設定を更新
      await currentConfig.update('claudeBackgroundModel', backgroundItem.id, true);
      await currentConfig.update('claudeThinkModel', thinkItem.id, true);
      
      vscode.window.showInformationMessage(
        `Claude Code models configured:\n` +
        `Background (haiku): ${backgroundItem.label} (${backgroundItem.id})\n` +
        `Think (sonnet): ${thinkItem.label} (${thinkItem.id})`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Error configuring Claude Code models: ${(error as Error).message}`);
    }
  });
  
  // 新しいコマンドを登録
  context.subscriptions.push(configureOpenaiModelCommand);
  context.subscriptions.push(configureAnthropicModelCommand);
  context.subscriptions.push(configureClaudeCodeModelsCommand);

  // 前回選択されたモデルを復元
  const previouslySelectedModel = context.globalState.get<string>('selectedModelId');
  const previouslySelectedModelName = context.globalState.get<string>('selectedModelName');
  if (previouslySelectedModel) {
    // モデル選択状態を復元
    modelManager.setSelectedModel(previouslySelectedModel, previouslySelectedModelName || undefined);
    console.log(`Restored previously selected model: ${previouslySelectedModelName || previouslySelectedModel}`);
    // ステータスバーも更新
    statusBarManager.updateStatus(serverManager.isRunning());
  }
}
