// トークン制限とレート制限の管理
import * as vscode from 'vscode';

/**
 * モデルごとのトークン上限の設定
 */
interface ModelTokenLimits {
  [modelId: string]: number;
}

/**
 * レート制限トラッキング情報
 */
interface RateLimitInfo {
  count: number;
  timestamp: number;
  windowMs: number;
}

/**
 * トークンとレート制限の管理クラス
 */
export class LimitsManager {
  // モデルファミリーごとのトークン上限定義
  private static readonly TOKEN_LIMITS: { [family: string]: number } = {
    'gpt-4o': 128000,
    'gpt-4o-mini': 32000,
    'o1': 128000,
    'o1-mini': 32000,
    'claude-3.5-sonnet': 200000
  };
  
  // デフォルトのトークン上限
  private static readonly DEFAULT_TOKEN_LIMIT = 16000;
  
  // モデルIDごとのトークン上限キャッシュ
  private tokenLimits: ModelTokenLimits = {};
  
  // レート制限トラッキング
  private rateLimits: Map<string, RateLimitInfo> = new Map();
  
  // レート制限の設定
  private readonly MAX_REQUESTS_PER_MINUTE = 10;
  private readonly RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1分
  
  /**
   * モデルIDのトークン上限を取得
   * @param modelId モデルID
   * @returns トークン上限
   */
  public getTokenLimit(modelId: string): number {
    // キャッシュにあればそれを返す
    if (this.tokenLimits[modelId]) {
      return this.tokenLimits[modelId];
    }
    
    // モデルファミリーを推測
    const family = this.getModelFamily(modelId);
    
    // ファミリーに基づいてトークン上限を設定
    let limit = LimitsManager.DEFAULT_TOKEN_LIMIT;
    if (family && LimitsManager.TOKEN_LIMITS[family]) {
      limit = LimitsManager.TOKEN_LIMITS[family];
    }
    
    // キャッシュに保存
    this.tokenLimits[modelId] = limit;
    return limit;
  }
  
  /**
   * モデルIDからファミリー名を推測
   * @param modelId モデルID
   * @returns 推測されたモデルファミリー
   */
  private getModelFamily(modelId: string): string | null {
    // モデルIDの小文字化
    const id = modelId.toLowerCase();
    
    // 既知のモデルファミリーとのマッチング
    for (const family of Object.keys(LimitsManager.TOKEN_LIMITS)) {
      if (id.includes(family)) {
        return family;
      }
    }
    
    return null;
  }
  
  /**
   * メッセージの合計トークン数を推定する簡易的な実装
   * 実際のOpenAIのトークナイザーとは異なる近似値
   * @param messages メッセージ配列
   * @returns 推定トークン数
   */
  public estimateTokenCount(messages: any[]): number {
    if (!messages || !Array.isArray(messages)) {
      return 0;
    }
    
    // 単純な文字数ベースの推定（英語で約4文字で1トークン）
    let totalChars = 0;
    
    for (const msg of messages) {
      // 各メッセージのロールと内容を計算
      if (msg.role) {
        totalChars += msg.role.length;
      }
      
      if (msg.content) {
        if (typeof msg.content === 'string') {
          totalChars += msg.content.length;
        } else if (Array.isArray(msg.content)) {
          // マルチモーダルコンテンツの場合
          for (const part of msg.content) {
            if (part.text) {
              totalChars += part.text.length;
            }
            // 画像などは固定トークン数として計算
            if (part.type === 'image') {
              totalChars += 1000; // 画像は約1000トークン相当と仮定
            }
          }
        }
      }
    }
    
    // 簡易的なトークン数推定（英語で約4文字で1トークン）
    return Math.ceil(totalChars / 4) + 100; // ベースコストとして100トークンを追加
  }
  
  /**
   * リクエストがトークン制限内かを検証
   * @param messages メッセージ配列
   * @param modelId モデルID
   * @returns 検証結果。問題がなければnullを返す
   */
  public validateTokenLimit(messages: any[], modelId: string): Error | null {
    const estimatedTokens = this.estimateTokenCount(messages);
    const tokenLimit = this.getTokenLimit(modelId);
    
    // トークン数が上限を超えている場合
    if (estimatedTokens > tokenLimit) {
      return new Error(
        `Token limit exceeded: estimated ${estimatedTokens} tokens, limit ${tokenLimit} tokens`
      );
    }
    
    return null;
  }
  
  /**
   * モデルIDに対するレート制限をチェック
   * @param modelId モデルID
   * @returns レート制限に達していればエラーを返す
   */
  public checkRateLimit(modelId: string): Error | null {
    const now = Date.now();
    const rateInfo = this.rateLimits.get(modelId);
    
    if (!rateInfo) {
      // 初めてのリクエスト
      this.rateLimits.set(modelId, { 
        count: 1, 
        timestamp: now,
        windowMs: this.RATE_LIMIT_WINDOW_MS
      });
      return null;
    }
    
    // 時間枠が過ぎていれば、カウンターをリセット
    if (now - rateInfo.timestamp > rateInfo.windowMs) {
      this.rateLimits.set(modelId, { 
        count: 1, 
        timestamp: now,
        windowMs: this.RATE_LIMIT_WINDOW_MS
      });
      return null;
    }
    
    // リクエスト数を増加
    rateInfo.count++;
    
    // リクエスト数が上限を超えた場合
    if (rateInfo.count > this.MAX_REQUESTS_PER_MINUTE) {
      const resetTime = rateInfo.timestamp + rateInfo.windowMs;
      const secondsToReset = Math.ceil((resetTime - now) / 1000);
      
      return new Error(
        `レート制限に達しました。${secondsToReset}秒後に再試行してください。`
      );
    }
    
    // 更新されたレート情報を保存
    this.rateLimits.set(modelId, rateInfo);
    return null;
  }
}

// シングルトンインスタンスをエクスポート
export const limitsManager = new LimitsManager();
