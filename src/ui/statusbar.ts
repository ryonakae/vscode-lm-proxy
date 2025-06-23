// ステータスバーの管理
import * as vscode from 'vscode';
import { serverManager } from '../server/manager';
import { modelManager } from '../model/manager';

/**
 * ステータスバー管理クラス
 * サーバーの状態とモデル情報をVS Codeステータスバーに表示
 */
class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem | undefined;
  
  /**
   * ステータスバーを初期化
   * @param context 拡張機能のコンテキスト
   */
  public initialize(context: vscode.ExtensionContext): void {
    // ステータスバーアイテムを作成
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right, 
      100
    );
    
    this.statusBarItem.command = 'vscode-lm-proxy.showStatusMenu';
    this.statusBarItem.tooltip = 'Language Model Proxy';
    
    // 初期状態を設定
    this.updateStatus(false);
    
    // ステータスバーを表示
    this.statusBarItem.show();
    
    // モデル変更イベントをリッスン
    context.subscriptions.push(
      modelManager.onDidChangeSelectedModel(() => {
        // モデルが変更されたらステータスバーを更新
        this.updateStatus(serverManager.isRunning());
      })
    );
    
    // ステータスメニューコマンドを登録
    const statusMenuCommand = vscode.commands.registerCommand(
      'vscode-lm-proxy.showStatusMenu', 
      this.showStatusMenu.bind(this)
    );
    
    // コンテキストに登録
    context.subscriptions.push(this.statusBarItem, statusMenuCommand);
  }

  /**
   * サーバー状態に応じてステータスバーを更新
   * @param isRunning サーバーが実行中かどうか
   * @param errorMessage エラーメッセージ（オプション）
   */
  public updateStatus(isRunning: boolean, errorMessage?: string): void {
    if (!this.statusBarItem) {
      return;
    }
    
    // 選択中のモデル名とモデル設定情報を取得
    const selectedModelName = modelManager.getSelectedModelName();
    const openaiModel = modelManager.getOpenaiModelId();
    const anthropicModel = modelManager.getAnthropicModelId();
    const claudeBackgroundModel = modelManager.getClaudeBackgroundModelId();
    const claudeThinkModel = modelManager.getClaudeThinkModelId();
    
    if (errorMessage) {
      // エラー状態
      this.statusBarItem.text = `$(error) LM Proxy`;
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      this.statusBarItem.tooltip = `Server: Error - ${errorMessage}`;
    } else if (isRunning) {
      // 実行中
      this.statusBarItem.text = `$(server) LM Proxy`;
      this.statusBarItem.backgroundColor = undefined;
      const url = serverManager.getServerUrl();
      this.statusBarItem.tooltip = 
        `Server: Running (${url})\n` +
        `Selected Model: ${selectedModelName || 'Not selected'}\n` +
        `OpenAI API Model: ${openaiModel === 'vscode-lm-proxy' ? selectedModelName || 'Not selected' : openaiModel}\n` +
        `Anthropic API Model: ${anthropicModel === 'vscode-lm-proxy' ? selectedModelName || 'Not selected' : anthropicModel}\n` +
        `Claude Code Background Model: ${claudeBackgroundModel === 'vscode-lm-proxy' ? selectedModelName || 'Not selected' : claudeBackgroundModel}\n` +
        `Claude Code Think Model: ${claudeThinkModel === 'vscode-lm-proxy' ? selectedModelName || 'Not selected' : claudeThinkModel}`;
    } else {
      // 停止中
      this.statusBarItem.text = `$(stop) LM Proxy`;
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.tooltip = 
        `Server: Stopped\n` +
        `Selected Model: ${selectedModelName || 'Not selected'}\n` +
        `OpenAI API Model: ${openaiModel === 'vscode-lm-proxy' ? selectedModelName || 'Not selected' : openaiModel}\n` +
        `Anthropic API Model: ${anthropicModel === 'vscode-lm-proxy' ? selectedModelName || 'Not selected' : anthropicModel}\n` +
        `Claude Code Background Model: ${claudeBackgroundModel === 'vscode-lm-proxy' ? selectedModelName || 'Not selected' : claudeBackgroundModel}\n` +
        `Claude Code Think Model: ${claudeThinkModel === 'vscode-lm-proxy' ? selectedModelName || 'Not selected' : claudeThinkModel}`;
    }
  }
  
  /**
   * ステータスメニューを表示
   */
  private async showStatusMenu(): Promise<void> {
    const isRunning = serverManager.isRunning();
    
    // メニュー項目を準備
    const items: Array<{label: string; description: string; command: string}> = [];
    
    if (isRunning) {
      items.push({
        label: '$(debug-stop) Stop Server',
        description: 'Stop the LM Proxy server',
        command: 'vscode-lm-proxy.stopServer'
      });
    } else {
      items.push({
        label: '$(play) Start Server',
        description: 'Start the LM Proxy server',
        command: 'vscode-lm-proxy.startServer'
      });
    }
    
    // モデル関連のメニュー項目を追加
    items.push({
      label: '$(gear) Select Model',
      description: 'Select a primary model for LM Proxy',
      command: 'vscode-lm-proxy.selectModel'
    });
    
    // OpenAI API用モデル設定
    items.push({
      label: '$(settings-gear) Configure OpenAI API Model',
      description: 'Set a specific model for OpenAI API endpoints',
      command: 'vscode-lm-proxy.configureOpenaiModel'
    });
    
    // Anthropic API用モデル設定
    items.push({
      label: '$(settings-gear) Configure Anthropic API Model',
      description: 'Set a specific model for Anthropic API endpoints',
      command: 'vscode-lm-proxy.configureAnthropicModel'
    });
    
    // Claude Code用モデル設定
    items.push({
      label: '$(settings-gear) Configure Claude Code Models',
      description: 'Set specific models for Claude Code features',
      command: 'vscode-lm-proxy.configureClaudeCodeModels'
    });
    
    // メニューを表示
    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select LM Proxy Operation'
    });
    
    // 選択されたコマンドを実行
    if (selected) {
      await vscode.commands.executeCommand(selected.command);
    }
  }
}

// シングルトンインスタンスをエクスポート
export const statusBarManager = new StatusBarManager();
