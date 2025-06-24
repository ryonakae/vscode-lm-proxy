// VSCode拡張機能のエントリーポイント
import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { serverManager } from './server/manager';
import { statusBarManager } from './ui/statusbar';
import { logger } from './utils/logger';

// グローバルコンテキストの保存用変数
let globalExtensionContext: vscode.ExtensionContext;

// グローバルモデルマネージャー変数
let modelManager: any;

// モデルマネージャーを取得する関数をエクスポート
export function getModelManager() {
  return modelManager;
}

// 拡張機能が有効化された時に実行される関数
export function activate(context: vscode.ExtensionContext) {
  // グローバル変数にコンテキストを保存
  globalExtensionContext = context;
  
  // モデル管理クラスのインポートと初期化（グローバル変数に格納）
  modelManager = require('./model/manager').modelManager;
  
  // モデルマネージャーにExtensionContextを設定
  // これにより内部で保存されたモデル情報が復元される
  modelManager.setExtensionContext(context);
  
  // 選択中のOpenAIモデルとサーバー状態をログに出力
  const openaiModel = modelManager.getOpenaiModelId() || 'Not selected';
  const serverStatus = serverManager.isRunning() ? 'Running' : 'Stopped';
  logger.info(`LM Proxy extension activated (Model: ${openaiModel}, Server: ${serverStatus})`);

  // 設定に応じて出力パネルを表示
  const config = vscode.workspace.getConfiguration('vscode-lm-proxy');
  const showOnStartup = config.get<boolean>('showOutputOnStartup', true);
  if (showOnStartup) {
    logger.show(true); // フォーカスは現在のエディタに保持
  }

  // コンテキスト変数の初期化
  vscode.commands.executeCommand('setContext', 'vscode-lm-proxy.serverRunning', false);
  
  // ステータスバーの初期化
  statusBarManager.initialize(context);

  // コマンドの登録
  registerCommands(context);
  
  // 設定変更の監視
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('vscode-lm-proxy.port') && serverManager.isRunning()) {
        vscode.window.showInformationMessage(
          'Port number setting has been changed. Please restart the server to apply the change.'
        );
      }
    })
  );

  // 状態復元
  // 以前サーバーが実行中だった場合は自動的に再起動
  const wasServerRunning = context.globalState.get<boolean>('serverRunning', false);
  if (wasServerRunning) {
    serverManager.start()
      .then(() => {
        const serverUrl = serverManager.getServerUrl();
        vscode.window.showInformationMessage(`Language Model Proxy server started (${serverUrl})`);
      })
      .catch(err => {
        vscode.window.showErrorMessage(`Failed to auto-start server: ${err.message}`);
      });
  }
}

// 拡張機能が無効化された時に実行される関数
export function deactivate(): Promise<void> | undefined {
  logger.info('LM Proxy extension deactivated');
  
  // OpenAIモデル情報を保存（グローバル変数に格納されているモデルマネージャーを使用）
  const openaiModelId = modelManager.getOpenaiModelId();
  
  // グローバル状態へOpenAIモデル情報と実行状態を保存
  globalExtensionContext.globalState.update('openaiModelId', openaiModelId);
  globalExtensionContext.globalState.update('serverRunning', serverManager.isRunning());
  
  // サーバーが実行中なら停止
  if (serverManager.isRunning()) {
    return serverManager.stop();
  }
  
  return undefined;
}
