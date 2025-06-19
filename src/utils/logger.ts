// VSCode出力パネル用のロガークラス
import * as vscode from 'vscode';

/**
 * ログレベルの定義
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

/**
 * VSCode出力パネルへのログ出力を管理するクラス
 */
export class Logger {
  private outputChannel: vscode.OutputChannel;
  private currentLogLevel: LogLevel;
  
  constructor() {
    // 出力チャンネルの作成
    this.outputChannel = vscode.window.createOutputChannel('LM Proxy');
    
    // 設定からログレベルを取得（デフォルト：DEBUG）
    const config = vscode.workspace.getConfiguration('vscode-lm-proxy');
    this.currentLogLevel = config.get<LogLevel>('logLevel') ?? LogLevel.DEBUG;
    
    // 現在のログレベルを表示
    this.outputChannel.appendLine(this.formatMessage('INFO', `Logger initialized with log level: ${LogLevel[this.currentLogLevel]}`));
    if (this.currentLogLevel > LogLevel.DEBUG) {
      this.outputChannel.appendLine(this.formatMessage('INFO', `For detailed request/response logs, set "vscode-lm-proxy.logLevel": 0 in settings.json`));
    }
    
    // 設定変更を監視
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('vscode-lm-proxy.logLevel')) {
        const config = vscode.workspace.getConfiguration('vscode-lm-proxy');
        this.currentLogLevel = config.get<LogLevel>('logLevel') ?? LogLevel.INFO;
        this.info(`Log level changed to ${LogLevel[this.currentLogLevel]}`);
      }
    });
  }

  /**
   * 現在のタイムスタンプを取得
   * @returns フォーマットされたタイムスタンプ
   */
  private getTimestamp(): string {
    const now = new Date();
    return now.toISOString();
  }

  /**
   * メッセージをフォーマットする
   * @param level ログレベル
   * @param message メッセージ
   * @returns フォーマットされたメッセージ
   */
  private formatMessage(level: string, message: string): string {
    return `[${this.getTimestamp()}] [${level}] ${message}`;
  }

  /**
   * 出力チャンネルを表示する
   * @param preserveFocus フォーカスを現在のエディタに保持するかどうか
   */
  public show(preserveFocus: boolean = true): void {
    this.outputChannel.show(preserveFocus);
  }

  /**
   * DEBUGレベルのログを出力
   * @param message ログメッセージ
   */
  public debug(message: string): void {
    if (this.currentLogLevel <= LogLevel.DEBUG) {
      this.outputChannel.appendLine(this.formatMessage('DEBUG', message));
    }
  }

  /**
   * INFOレベルのログを出力
   * @param message ログメッセージ
   */
  public info(message: string): void {
    if (this.currentLogLevel <= LogLevel.INFO) {
      this.outputChannel.appendLine(this.formatMessage('INFO', message));
    }
  }

  /**
   * WARNレベルのログを出力
   * @param message ログメッセージ
   */
  public warn(message: string): void {
    if (this.currentLogLevel <= LogLevel.WARN) {
      this.outputChannel.appendLine(this.formatMessage('WARN', message));
    }
  }

  /**
   * ERRORレベルのログを出力
   * @param message ログメッセージ
   * @param error エラーオブジェクト（オプション）
   */
  public error(message: string, error?: Error): void {
    if (this.currentLogLevel <= LogLevel.ERROR) {
      this.outputChannel.appendLine(this.formatMessage('ERROR', message));
      if (error && error.stack) {
        this.outputChannel.appendLine(this.formatMessage('ERROR', `Stack: ${error.stack}`));
      }
    }
  }

  /**
   * 出力チャンネルをクリア
   */
  public clear(): void {
    this.outputChannel.clear();
  }

  /**
   * APIリクエストをログ出力
   * @param method HTTPメソッド
   * @param path エンドポイントのパス
   * @param body リクエストボディ
   */
  public logRequest(method: string, path: string, body?: any): void {
    // リクエストの概要情報はINFOレベルで出力
    if (this.currentLogLevel <= LogLevel.INFO) {
      this.outputChannel.appendLine(this.formatMessage('REQUEST', `${method} ${path}`));
      
      // 詳細なボディ情報はDEBUGレベルでのみ出力
      if (body && this.currentLogLevel <= LogLevel.DEBUG) {
        // ヘッダー行を追加して見やすくする
        this.outputChannel.appendLine(this.formatMessage('REQUEST', '=============== Request Body ==============='));
        // リクエストボディを整形して表示
        const bodyStr = this.formatJSONForLog(body);
        this.outputChannel.appendLine(bodyStr);
        this.outputChannel.appendLine(this.formatMessage('REQUEST', '=========================================='));
      }
    }
  }

  /**
   * APIレスポンスをログ出力
   * @param status ステータスコード
   * @param path エンドポイントのパス
   * @param body レスポンスボディ
   * @param responseTime レスポンス時間（ms）
   */
  public logResponse(status: number, path: string, body?: any, responseTime?: number): void {
    // レスポンスの概要情報はINFOレベルで出力
    if (this.currentLogLevel <= LogLevel.INFO) {
      const timeInfo = responseTime ? ` (${responseTime}ms)` : '';
      this.outputChannel.appendLine(this.formatMessage('RESPONSE', `${status} ${path}${timeInfo}`));
      
      // 詳細なボディ情報はDEBUGレベルでのみ出力
      if (body && this.currentLogLevel <= LogLevel.DEBUG) {
        // ヘッダー行を追加して見やすくする
        this.outputChannel.appendLine(this.formatMessage('RESPONSE', '=============== Response Body ==============='));
        // レスポンスボディを整形して表示
        const bodyStr = this.formatJSONForLog(body);
        this.outputChannel.appendLine(bodyStr);
        this.outputChannel.appendLine(this.formatMessage('RESPONSE', '==========================================='));
      }
    }
  }

  /**
   * ストリーミングレスポンスの開始をログ出力
   * @param path エンドポイントのパス
   */
  public logStreamStart(path: string): void {
    if (this.currentLogLevel <= LogLevel.INFO) {
      this.outputChannel.appendLine(this.formatMessage('STREAM', `Started streaming response for ${path}`));
    }
  }

  /**
   * ストリーミングレスポンスのチャンクをログ出力
   * @param path エンドポイントのパス
   * @param chunk ストリーミングチャンク
   * @param index チャンクのインデックス
   */
  public logStreamChunk(path: string, chunk: any, index: number): void {
    if (this.currentLogLevel <= LogLevel.DEBUG) {
      // ストリーミングの詳細データはデバッグレベルでのみ表示
      this.outputChannel.appendLine(this.formatMessage('STREAM', `Chunk #${index} for ${path}`));
      
      // チャンクの内容を整形して表示（インデントなし、簡潔に）
      const chunkStr = this.formatJSONForLog(chunk, 1000, false);
      
      // ストリーミングデータの内容を表示
      if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content) {
        const content = chunk.choices[0].delta.content;
        this.outputChannel.appendLine(this.formatMessage('STREAM_CONTENT', `"${content}"`));
      } else {
        this.outputChannel.appendLine(this.formatMessage('STREAM_DATA', chunkStr));
      }
    } else if (this.currentLogLevel <= LogLevel.INFO && index % 10 === 0) {
      // INFO レベルでは10チャンクごとにカウントのみ表示
      this.outputChannel.appendLine(this.formatMessage('STREAM', `Processing chunk #${index} for ${path}`));
    }
  }

  /**
   * ストリーミングレスポンスの終了をログ出力
   * @param path エンドポイントのパス
   * @param responseTime 合計レスポンス時間（ms）
   */
  public logStreamEnd(path: string, responseTime?: number): void {
    if (this.currentLogLevel <= LogLevel.INFO) {
      const timeInfo = responseTime ? ` (total: ${responseTime}ms)` : '';
      this.outputChannel.appendLine(this.formatMessage('STREAM', `Completed streaming response for ${path}${timeInfo}`));
    }
  }

  /**
   * JSONデータをログ用に整形
   * @param data 表示するJSONデータ
   * @param maxLength 最大表示長（デフォルト: 2000文字）
   * @param indent インデントを付けるかどうか
   * @returns 整形されたJSON文字列
   */
  private formatJSONForLog(data: any, maxLength: number = 2000, indent: boolean = true): string {
    try {
      // 編集可能なコピーを作成
      const dataCopy = this.sanitizeForLog(JSON.parse(JSON.stringify(data)));
      
      // インデントを付けて整形（読みやすさ向上）
      let jsonStr = indent 
        ? JSON.stringify(dataCopy, null, 2)
        : JSON.stringify(dataCopy);
      
      // 文字列が長すぎる場合は切り詰める
      if (jsonStr.length > maxLength) {
        jsonStr = jsonStr.substring(0, maxLength) + '...(truncated)';
      }
      
      return jsonStr;
    } catch (e) {
      return String(data).substring(0, maxLength);
    }
  }

  /**
   * ログ出力用にオブジェクトを整形（機密情報のマスクなど）
   * @param obj 整形するオブジェクト
   * @returns 整形されたオブジェクト
   */
  private sanitizeForLog(obj: any): any {
    // まだオブジェクトでない場合はそのまま返す
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    
    // 配列の場合は各要素を再帰的に処理
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeForLog(item));
    }
    
    // APIキーの値など、機密情報をマスク
    const sensitiveKeys = ['api_key', 'apiKey', 'authorization', 'password', 'secret', 'token'];
    const result: any = {};
    
    // オブジェクトのプロパティを処理
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // 機密キーの場合は値をマスク
        if (sensitiveKeys.includes(key.toLowerCase())) {
          result[key] = '*****';
        } 
        // メッセージ配列は内容を表示
        else if (key === 'messages' && Array.isArray(obj[key]) && obj[key].length > 0) {
          // メッセージの詳細を残すが、長いコンテンツは短縮
          result[key] = obj[key].map((msg: any) => {
            if (msg && typeof msg === 'object') {
              const msgCopy = { ...msg };
              // コンテンツが長い場合は短縮
              if (msgCopy.content && typeof msgCopy.content === 'string' && msgCopy.content.length > 100) {
                msgCopy.content = msgCopy.content.substring(0, 100) + '...';
              }
              return msgCopy;
            }
            return msg;
          });
        }
        // 深いネストのオブジェクトは短縮
        else if (typeof obj[key] === 'object' && obj[key] !== null) {
          result[key] = this.sanitizeForLog(obj[key]);
        } 
        // それ以外はそのまま
        else {
          result[key] = obj[key];
        }
      }
    }
    
    return result;
  }
}

// シングルトンインスタンスをエクスポート
export const logger = new Logger();
