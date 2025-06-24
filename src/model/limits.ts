// トークン制限とレート制限の管理
import * as vscode from 'vscode';
import { logger } from '../utils/logger';

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
  // フォールバック用のトークン上限定義
  private static readonly FALLBACK_TOKEN_LIMITS: { [family: string]: number } = {
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
   * VSCode LM APIから直接モデル情報を取得し、トークン上限を取得する
   * @param modelId モデルID
   * @returns トークン上限のPromise
   */
  public async getTokenLimit(modelId: string): Promise<number> {
    logger.info(`Getting token limit for model: ${modelId}`);

    // キャッシュにあればそれを返す
    if (this.tokenLimits[modelId]) {
      return this.tokenLimits[modelId];
    }
    
    try {
      // VSCode LM APIからモデル情報を取得
      const models = await vscode.lm.selectChatModels({ id: modelId });
      logger.info(`Retrieved models for ${modelId}: ${JSON.stringify(models)}`);
      
      if (models && models.length > 0) {
        const model = models[0];
        
        // モデルから直接トークン上限を取得
        if ('maxInputTokens' in model) {
          const limit = model.maxInputTokens;
          this.tokenLimits[modelId] = limit;
          logger.info(`Model ${modelId} token limit retrieved from maxInputTokens: ${limit}`);
          return limit;
        }
      }
      
      // モデル情報が取得できなかった場合はフォールバック処理
      logger.warn(`Could not get token limit from API for model ${modelId}, using fallback values`);
      return this.getFallbackTokenLimit(modelId);
    } catch (error) {
      // エラーが発生した場合はログを残し、フォールバック値を返す
      logger.error(`Error getting token limit from API: ${(error as Error).message}`, error as Error);
      return this.getFallbackTokenLimit(modelId);
    }
  }
  
  /**
   * フォールバック用のトークン上限を取得
   * API呼び出しが失敗した場合に使用
   * @param modelId モデルID
   * @returns トークン上限
   */
  private getFallbackTokenLimit(modelId: string): number {
    // モデルファミリーを推測
    const family = this.getModelFamily(modelId);
    
    // ファミリーに基づいてトークン上限を設定
    let limit = LimitsManager.DEFAULT_TOKEN_LIMIT;
    if (family && LimitsManager.FALLBACK_TOKEN_LIMITS[family]) {
      limit = LimitsManager.FALLBACK_TOKEN_LIMITS[family];
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
    for (const family of Object.keys(LimitsManager.FALLBACK_TOKEN_LIMITS)) {
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
  public async validateTokenLimit(messages: any[], modelId: string): Promise<Error | null> {
    // 正確なトークン数を計算
    const tokenCount = await this.countTokens(messages, modelId);
    const tokenLimit = await this.getTokenLimit(modelId);
    
    // トークン数が上限を超えている場合
    if (tokenCount > tokenLimit) {
      return new Error(
        `Token limit exceeded: counted ${tokenCount} tokens, limit ${tokenLimit} tokens`
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
        `Rate limit reached. Please try again in ${secondsToReset} seconds.`
      );
    }
    
    // 更新されたレート情報を保存
    this.rateLimits.set(modelId, rateInfo);
    return null;
  }
  
  /**
   * VSCode LM APIを使用して正確なトークン数を計算する
   * @param messages メッセージ配列
   * @param modelId モデルID
   * @returns 正確なトークン数（計算できなかった場合は推定値）
   */
  public async countTokens(messages: any[], modelId: string): Promise<number> {
    try {
      // モデルを取得
      const [model] = await vscode.lm.selectChatModels({ id: modelId });
      
      if (!model) {
        // モデルが見つからない場合は推定値を使用
        logger.warn(`Model ${modelId} not found. Using estimated token count.`);
        return this.estimateTokenCount(messages);
      }
      
      // VSCode LM API形式にメッセージを変換
      const vscodeLmMessages = messages.map(msg => {
        if (msg.role === 'user') {
          return vscode.LanguageModelChatMessage.User(msg.content);
        } else if (msg.role === 'assistant') {
          return vscode.LanguageModelChatMessage.Assistant(msg.content);
        } else {
          // システムメッセージなどはユーザーメッセージとして扱う
          return vscode.LanguageModelChatMessage.User(msg.content);
        }
      });
      
      // 各メッセージのトークン数を計算して合計
      let totalTokens = 0;
      for (const message of vscodeLmMessages) {
        totalTokens += await model.countTokens(message);
      }
      
      return totalTokens;
    } catch (error) {
      // エラーが発生した場合はログを残し、推定値にフォールバック
      logger.error(`Error counting tokens: ${(error as Error).message}`, error as Error);
      return this.estimateTokenCount(messages);
    }
  }
}

// シングルトンインスタンスをエクスポート
export const limitsManager = new LimitsManager();
