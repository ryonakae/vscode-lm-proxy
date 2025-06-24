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
        vscode.window.showInformationMessage(`Model selected: ${selectedModel}`);

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
        id: model.id,
        name: model.name
      }));
      
      const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: 'Select model for OpenAI API endpoints',
        title: 'Configure OpenAI API Model'
      });
      
      if (selectedItem) {
        // globalStateに保存
        modelManager.setOpenaiModelId(selectedItem.id, selectedItem.name);
        
        vscode.window.showInformationMessage(
          `OpenAI API model set to: ${selectedItem.label} (${selectedItem.id})`
        );
        
        // ステータスバーを更新 (非同期でタイミングをずらして確実に更新を反映)
        setTimeout(() => {
          statusBarManager.updateStatus(serverManager.isRunning());
        }, 10);
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
        id: model.id,
        name: model.name
      }));
      
      const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: 'Select model for Anthropic API endpoints',
        title: 'Configure Anthropic API Model'
      });
      
      if (selectedItem) {
        // globalStateに保存
        modelManager.setAnthropicModelId(selectedItem.id, selectedItem.name);
        
        vscode.window.showInformationMessage(
          `Anthropic API model set to: ${selectedItem.label} (${selectedItem.id})`
        );
        
        // ステータスバーを更新 (非同期でタイミングをずらして確実に更新を反映)
        setTimeout(() => {
          statusBarManager.updateStatus(serverManager.isRunning());
        }, 10);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error configuring Anthropic model: ${(error as Error).message}`);
    }
  });

  /**
   * Claude Code Background モデル個別設定コマンド
   * @see https://github.com/ryo-nakae/vscode-lm-proxy
   */
  const configureClaudeBackgroundModelsCommand = vscode.commands.registerCommand('vscode-lm-proxy.configureClaudeBackgroundModels', async () => {
    try {
      const availableModels = await modelManager.getAvailableModels();
      const modelOptions = availableModels.map(model => ({
        label: model.name,
        description: `${model.id}`,
        id: model.id,
        name: model.name,
      }));
      const selectedItem = await vscode.window.showQuickPick(modelOptions, {
        placeHolder: 'Select model for Claude Code background tasks (haiku)',
        title: 'Configure Claude Code Background Model',
      });

      if (!selectedItem) return;

      modelManager.setClaudeBackgroundModelId(selectedItem.id, selectedItem.name);
      vscode.window.showInformationMessage(
        `Claude Code background model set to: ${selectedItem.label} (${selectedItem.id})`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Error configuring Claude Code background model: ${(error as Error).message}`);
    }
  });

  /**
   * Claude Code Thinking モデル個別設定コマンド
   * @see https://github.com/ryo-nakae/vscode-lm-proxy
   */
  const configureClaudeThinkingModelsCommand = vscode.commands.registerCommand('vscode-lm-proxy.configureClaudeThinkingModels', async () => {
    try {
      const availableModels = await modelManager.getAvailableModels();
      const modelOptions = availableModels.map(model => ({
        label: model.name,
        description: `${model.id}`,
        id: model.id,
        name: model.name,
      }));
      const selectedItem = await vscode.window.showQuickPick(modelOptions, {
        placeHolder: 'Select model for Claude Code thinking tasks (sonnet)',
        title: 'Configure Claude Code Thinking Model',
      });

      if (!selectedItem) return;
      
      modelManager.setClaudeThinkModelId(selectedItem.id, selectedItem.name);
      vscode.window.showInformationMessage(
        `Claude Code thinking model set to: ${selectedItem.label} (${selectedItem.id})`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Error configuring Claude Code thinking model: ${(error as Error).message}`);
    }
  });

  // 新しいコマンドを登録
  context.subscriptions.push(configureOpenaiModelCommand);
  context.subscriptions.push(configureAnthropicModelCommand);
  context.subscriptions.push(configureClaudeBackgroundModelsCommand);
  context.subscriptions.push(configureClaudeThinkingModelsCommand);
}
