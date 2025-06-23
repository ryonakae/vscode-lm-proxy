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

// モデル設定を復元・初期化する関数
function initializeModelSettings(config: vscode.WorkspaceConfiguration) {
  // 各モデル設定値がない場合はデフォルト値（vscode-lm-proxy）を設定
  if (!config.has('openaiModel')) {
    config.update('openaiModel', 'vscode-lm-proxy', true);
    logger.info('Initialized OpenAI model setting to default value');
  }
  
  if (!config.has('anthropicModel')) {
    config.update('anthropicModel', 'vscode-lm-proxy', true);
    logger.info('Initialized Anthropic model setting to default value');
  }
  
  if (!config.has('claudeBackgroundModel')) {
    config.update('claudeBackgroundModel', 'vscode-lm-proxy', true);
    logger.info('Initialized Claude Code background model setting to default value');
  }
  
  if (!config.has('claudeThinkModel')) {
    config.update('claudeThinkModel', 'vscode-lm-proxy', true);
    logger.info('Initialized Claude Code think model setting to default value');
  }
  
  // 現在の設定値をログ出力
  logger.info(`Model settings: OpenAI=${config.get('openaiModel')}, ` +
    `Anthropic=${config.get('anthropicModel')}, ` +
    `Claude Background=${config.get('claudeBackgroundModel')}, ` +
    `Claude Think=${config.get('claudeThinkModel')}`);
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
  
  // 選択中のモデルとサーバー状態をログに出力
  const selectedModel = modelManager.getSelectedModelName() || 'Not selected';
  const serverStatus = serverManager.isRunning() ? 'Running' : 'Stopped';
  logger.info(`LM Proxy extension activated (Model: ${selectedModel}, Server: ${serverStatus})`);

  // 設定に応じて出力パネルを表示
  const config = vscode.workspace.getConfiguration('vscode-lm-proxy');
  const showOnStartup = config.get<boolean>('showOutputOnStartup', true);
  if (showOnStartup) {
    logger.show(true); // フォーカスは現在のエディタに保持
  }
  
  // モデル設定の初期化
  initializeModelSettings(config);

  // コンテキスト変数の初期化
  vscode.commands.executeCommand('setContext', 'vscode-lm-proxy.serverRunning', false);
  
  // ステータスバーの初期化
  statusBarManager.initialize(context);

  // コマンドの登録
  registerCommands(context);
  
  // 設定変更の監視
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      // ポート番号の変更を監視
      if (e.affectsConfiguration('vscode-lm-proxy.port') && serverManager.isRunning()) {
        vscode.window.showInformationMessage(
          'Port number setting has been changed. Please restart the server to apply the change.'
        );
      }
      
      // モデル設定の変更を監視
      if (e.affectsConfiguration('vscode-lm-proxy.openaiModel') || 
          e.affectsConfiguration('vscode-lm-proxy.anthropicModel') || 
          e.affectsConfiguration('vscode-lm-proxy.claudeBackgroundModel') || 
          e.affectsConfiguration('vscode-lm-proxy.claudeThinkModel')) {
        
        const config = vscode.workspace.getConfiguration('vscode-lm-proxy');
        logger.info(`Model settings updated: OpenAI=${config.get('openaiModel')}, ` +
          `Anthropic=${config.get('anthropicModel')}, ` +
          `Claude Background=${config.get('claudeBackgroundModel')}, ` +
          `Claude Think=${config.get('claudeThinkModel')}`);
          
        if (serverManager.isRunning()) {
          vscode.window.showInformationMessage(
            'Model settings have been changed and will apply to new requests. Active streaming responses may continue using the previous models.'
          );
        }
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
  
  // モデル情報を保存（グローバル変数に格納されているモデルマネージャーを使用）
  const selectedModelId = modelManager.getSelectedModel();
  const selectedModelName = modelManager.getSelectedModelName();
  
  // グローバル状態へモデル情報と実行状態を保存
  globalExtensionContext.globalState.update('selectedModelId', selectedModelId);
  globalExtensionContext.globalState.update('selectedModelName', selectedModelName);
  globalExtensionContext.globalState.update('serverRunning', serverManager.isRunning());
  
  // サーバーが実行中なら停止
  if (serverManager.isRunning()) {
    return serverManager.stop();
  }
  
  return undefined;
}
