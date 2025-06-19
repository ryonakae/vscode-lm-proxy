// サーバーの起動・停止・状態管理を行うマネージャー
import * as vscode from 'vscode';
import { createServer } from './server';
import * as http from 'http';
import { statusBarManager } from '../ui/statusbar';

/**
 * サーバーマネージャークラス
 * Express.jsサーバーの起動・停止・状態管理を行う
 */
class ServerManager {
  private server: http.Server | null = null;
  private port: number = 4000;
  private _isRunning: boolean = false;

  /**
   * サーバーを起動する
   * @returns サーバー起動のPromise
   */
  public async start(): Promise<void> {
    if (this._isRunning) {
      return Promise.resolve();
    }

    try {
      const app = createServer();
      
      return new Promise<void>((resolve, reject) => {
        this.server = app.listen(this.port, () => {
          this._isRunning = true;
          vscode.commands.executeCommand('setContext', 'vscode-lm-proxy.serverRunning', true);
          console.log(`VSCode LM Proxyサーバーがポート${this.port}で起動しました`);
          statusBarManager.updateStatus(true);
          resolve();
        });

        this.server.on('error', (err) => {
          this._isRunning = false;
          vscode.commands.executeCommand('setContext', 'vscode-lm-proxy.serverRunning', false);
          statusBarManager.updateStatus(false, `サーバー起動エラー: ${(err as Error).message}`);
          reject(new Error(`サーバー起動エラー: ${(err as Error).message}`));
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
          reject(new Error(`サーバー停止エラー: ${err.message}`));
          return;
        }
        
        this.server = null;
        this._isRunning = false;
        vscode.commands.executeCommand('setContext', 'vscode-lm-proxy.serverRunning', false);
        console.log('VSCode LM Proxyサーバーが停止しました');
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
    return `http://localhost:${this.port}`;
  }
}

// シングルトンインスタンスをエクスポート
export const serverManager = new ServerManager();
