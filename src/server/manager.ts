// サーバーの起動・停止・状態管理を行うマネージャー
import * as vscode from 'vscode';
import { createServer } from './server';
import * as http from 'http';
import { statusBarManager } from '../ui/statusbar';
import { logger } from '../utils/logger';

/**
 * サーバーマネージャークラス
 * Express.jsサーバーの起動・停止・状態管理を行う
 */
class ServerManager {
  private server: http.Server | null = null;
  private _isRunning: boolean = false;
  
  /**
   * 設定からポート番号を取得
   * @returns 設定されたポート番号（デフォルト: 4000）
   */
  private getPort(): number {
    const config = vscode.workspace.getConfiguration('vscode-lm-proxy');
    return config.get<number>('port', 4000);
  }

  /**
   * サーバーを起動する
   * @returns サーバー起動のPromise
   */
  public async start(): Promise<void> {
    if (this._isRunning) {
      return Promise.resolve();
    }

    // モデルが選択されているか確認
    const modelManager = require('../extension').getModelManager();
    if (!modelManager.getSelectedModelId()) {
      return Promise.reject(new Error('No model selected. Please select a model first.'));
    }

    try {
      const app = createServer();
      const port = this.getPort();
      
      return new Promise<void>((resolve, reject) => {
        this.server = app.listen(port, () => {
          this._isRunning = true;
          vscode.commands.executeCommand('setContext', 'vscode-lm-proxy.serverRunning', true);
          logger.info(`VSCode LM Proxy server started on port ${port}`);
          statusBarManager.updateStatus(true);
          resolve();
        });

        this.server.on('error', (err) => {
          this._isRunning = false;
          vscode.commands.executeCommand('setContext', 'vscode-lm-proxy.serverRunning', false);
          logger.error(`Server startup error: ${(err as Error).message}`, err as Error);
          statusBarManager.updateStatus(false, `Server startup error: ${(err as Error).message}`);
          reject(new Error(`Server startup error: ${(err as Error).message}`));
        });
      });
    } catch (error) {
      this._isRunning = false;
      vscode.commands.executeCommand('setContext', 'vscode-lm-proxy.serverRunning', false);
      return Promise.reject(error);
    }
  }

  /**
   * サーバーを停止する
   * @returns サーバー停止のPromise
   */
  public stop(): Promise<void> {
    if (!this._isRunning || !this.server) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      this.server?.close((err) => {
        if (err) {
          reject(new Error(`Server stop error: ${err.message}`));
          return;
        }
        
        this.server = null;
        this._isRunning = false;
        vscode.commands.executeCommand('setContext', 'vscode-lm-proxy.serverRunning', false);
        logger.info('VSCode LM Proxy server stopped');
        statusBarManager.updateStatus(false);
        resolve();
      });
    });
  }

  /**
   * サーバーが実行中かどうかを返す
   * @returns サーバーの実行状態
   */
  public isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * サーバーのURLを取得する
   * @returns サーバーのURL（実行中でない場合はnull）
   */
  public getServerUrl(): string | null {
    if (!this._isRunning) {
      return null;
    }
    return `http://localhost:${this.getPort()}`;
  }
}

// シングルトンインスタンスをエクスポート
export const serverManager = new ServerManager();
