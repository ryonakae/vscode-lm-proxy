// VSCode出力パネル用のロガークラス
import * as vscode from 'vscode'

/**
 * ログレベルの定義
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * VSCode出力パネルへのログ出力を管理するクラス
 */
export class Logger {
  private outputChannel: vscode.OutputChannel
  private currentLogLevel: LogLevel

  constructor() {
    // 出力チャンネルの作成
    this.outputChannel = vscode.window.createOutputChannel('LM Proxy')

    // 設定からログレベルを取得（デフォルト：DEBUG）
    const config = vscode.workspace.getConfiguration('vscode-lm-proxy')
    this.currentLogLevel = config.get<LogLevel>('logLevel') ?? LogLevel.DEBUG

    // 現在のログレベルを表示
    this.outputChannel.appendLine(
      this.formatMessage(
        'INFO',
        `Logger initialized with log level: ${LogLevel[this.currentLogLevel]}`,
      ),
    )
    if (this.currentLogLevel > LogLevel.DEBUG) {
      this.outputChannel.appendLine(
        this.formatMessage(
          'INFO',
          `For detailed request/response logs, set "vscode-lm-proxy.logLevel": 0 in settings.json`,
        ),
      )
    }

    // 設定変更を監視
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('vscode-lm-proxy.logLevel')) {
        const config = vscode.workspace.getConfiguration('vscode-lm-proxy')
        this.currentLogLevel = config.get<LogLevel>('logLevel') ?? LogLevel.INFO

        this.outputChannel.appendLine(
          this.formatMessage(
            'INFO',
            `Log level changed to ${LogLevel[this.currentLogLevel]}`,
          ),
        )
      }
    })
  }

  /**
   * 現在のタイムスタンプを取得
   * @returns フォーマットされたタイムスタンプ
   */
  private getTimestamp(): string {
    const now = new Date()
    return now.toISOString()
  }

  /**
   * メッセージをフォーマットする
   * @param level ログレベル
   * @param message メッセージ
   * @returns フォーマットされたメッセージ
   */
  private formatMessage(level: string, message: string): string {
    // 日付の括弧をトルツメ（例: 2025-06-25T06:00:00.000Z [INFO] ...）
    return `${this.getTimestamp()} [${level}] ${message}`
  }

  /**
   * 出力チャンネルを表示する
   * @param preserveFocus フォーカスを現在のエディタに保持するかどうか
   */
  public show(preserveFocus = true): void {
    this.outputChannel.show(preserveFocus)
  }

  /**
   * DEBUGレベルのログを出力
   * @param message ログメッセージまたはオブジェクト
   */
  public debug(...args: any[]): void {
    if (this.currentLogLevel <= LogLevel.DEBUG) {
      const msg = args
        .map(arg =>
          typeof arg === 'string' ? arg : this.formatJSONForLog(arg),
        )
        .join(' ')
      this.outputChannel.appendLine(this.formatMessage('DEBUG', msg))
    }
  }

  /**
   * INFOレベルのログを出力
   * @param message ログメッセージまたはオブジェクト
   */
  public info(...args: any[]): void {
    if (this.currentLogLevel <= LogLevel.INFO) {
      const msg = args
        .map(arg =>
          typeof arg === 'string' ? arg : this.formatJSONForLog(arg),
        )
        .join(' ')
      this.outputChannel.appendLine(this.formatMessage('INFO', msg))
    }
  }

  /**
   * WARNレベルのログを出力
   * @param message ログメッセージまたはオブジェクト
   */
  public warn(...args: any[]): void {
    if (this.currentLogLevel <= LogLevel.WARN) {
      const msg = args
        .map(arg =>
          typeof arg === 'string' ? arg : this.formatJSONForLog(arg),
        )
        .join(' ')
      this.outputChannel.appendLine(this.formatMessage('WARN', msg))
    }
  }

  /**
   * ERRORレベルのログを出力
   * @param message ログメッセージまたはオブジェクト
   * @param error エラーオブジェクト（オプション）
   */
  public error(...args: any[]): void {
    let errorObj: Error | undefined
    if (args.length > 0 && args[args.length - 1] instanceof Error) {
      errorObj = args.pop()
    }
    if (this.currentLogLevel <= LogLevel.ERROR) {
      const msg = args
        .map(arg =>
          typeof arg === 'string' ? arg : this.formatJSONForLog(arg),
        )
        .join(' ')
      this.outputChannel.appendLine(this.formatMessage('ERROR', msg))
      if (errorObj && errorObj.stack) {
        this.outputChannel.appendLine(
          this.formatMessage('ERROR', `Stack: ${errorObj.stack}`),
        )
      }
    }
  }

  /**
   * 出力チャンネルをクリア
   */
  public clear(): void {
    this.outputChannel.clear()
  }

  /**
   * JSONデータをログ用に整形
   * @param data 表示するJSONデータ
   * @param indent インデントを付けるかどうか
   * @returns 整形されたJSON文字列
   */
  private formatJSONForLog(data: any, indent = true): string {
    try {
      // 編集可能なコピーを作成
      const dataCopy = this.sanitizeForLog(JSON.parse(JSON.stringify(data)))

      // インデントを付けて整形（読みやすさ向上）
      const jsonStr = indent
        ? JSON.stringify(dataCopy, null, 2)
        : JSON.stringify(dataCopy)

      return jsonStr
    } catch (e) {
      return String(data)
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
      return obj
    }

    // 配列の場合は各要素を再帰的に処理
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeForLog(item))
    }

    // APIキーの値など、機密情報をマスク
    const sensitiveKeys = [
      'api_key',
      'apiKey',
      'authorization',
      'password',
      'secret',
      'token',
    ]
    const result: any = {}

    // オブジェクトのプロパティを処理
    for (const key in obj) {
      if (Object.hasOwn(obj, key)) {
        // 機密キーの場合は値をマスク
        if (sensitiveKeys.includes(key.toLowerCase())) {
          result[key] = '*****'
        }
        // メッセージ配列は内容を表示
        else if (
          key === 'messages' &&
          Array.isArray(obj[key]) &&
          obj[key].length > 0
        ) {
          // メッセージの詳細を残すが、長いコンテンツは短縮
          result[key] = obj[key].map((msg: any) => {
            if (msg && typeof msg === 'object') {
              const msgCopy = { ...msg }
              // コンテンツが長い場合は短縮
              if (
                msgCopy.content &&
                typeof msgCopy.content === 'string' &&
                msgCopy.content.length > 100
              ) {
                msgCopy.content = `${msgCopy.content.substring(0, 100)}...`
              }
              return msgCopy
            }
            return msg
          })
        }
        // 深いネストのオブジェクトは短縮
        else if (typeof obj[key] === 'object' && obj[key] !== null) {
          result[key] = this.sanitizeForLog(obj[key])
        }
        // それ以外はそのまま
        else {
          result[key] = obj[key]
        }
      }
    }

    return result
  }
}

// シングルトンインスタンスをエクスポート
export const logger = new Logger()
