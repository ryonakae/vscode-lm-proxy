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
    
    // 選択中のモデル名を取得（強制的に最新の状態を反映）
    const selectedModelName = modelManager.getSelectedModelName();
    // モデル表示テキスト
    const modelText = selectedModelName ? ` (${selectedModelName})` : ' (Model not selected)';
    
    if (errorMessage) {
      // エラー状態
      this.statusBarItem.text = `$(error) LM Proxy${modelText}`;
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      this.statusBarItem.tooltip = `Server: Error - ${errorMessage}`;
    } else if (isRunning) {
      // 実行中
      this.statusBarItem.text = `$(server) LM Proxy${modelText}`;
      this.statusBarItem.backgroundColor = undefined;
      const url = serverManager.getServerUrl();
      this.statusBarItem.tooltip = `Server: Running (${url})${selectedModelName ? `\nModel: ${selectedModelName}` : '\nModel: Not selected'}`;
    } else {
      // 停止中
      this.statusBarItem.text = `$(stop) LM Proxy${modelText}`;
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.tooltip = `Server: Stopped${selectedModelName ? `\nModel: ${selectedModelName}` : '\nModel: Not selected'}`;
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
    
    // モデル選択メニュー項目を追加
    items.push({
      label: '$(gear) Select Model',
      description: 'Select a model for LM Proxy',
      command: 'vscode-lm-proxy.selectModel'
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
