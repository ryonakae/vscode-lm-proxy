// モデル管理クラス
import * as vscode from 'vscode';
import { convertToOpenAIFormat } from './converter';
import { OpenAIChatCompletionResponse } from './types';
import { limitsManager } from './limits';

/**
 * モデル管理クラス
 * VSCode Language Model APIへのアクセスとモデル選択を管理
 */
class ModelManager {
  // 選択されたモデルID
  private selectedModelId: string | null = null;
  
  // サポートするモデルファミリー
  private supportedFamilies = [
    'gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'claude-3.5-sonnet'
  ];

  /**
   * 利用可能なモデルからモデルを選択する
   * @returns 選択したモデルのID
   */
  public async selectModel(): Promise<string | undefined> {
    try {
      const models = await vscode.lm.selectChatModels({
        includeFamily: this.supportedFamilies
      });
      
      if (!models || models.length === 0) {
        vscode.window.showWarningMessage('利用可能なモデルがありません');
        return undefined;
      }
      
      // 選択されたモデルを保存
      this.selectedModelId = models[0].id;
      
      // モデル情報をログ出力
      console.log(`選択されたモデル: ${models[0].name} (${models[0].id})`);
      
      return this.selectedModelId;
    } catch (error) {
      console.error('モデル選択エラー:', error);
      vscode.window.showErrorMessage(`モデルの選択中にエラーが発生しました: ${(error as Error).message}`);
      return undefined;
    }
  }

  /**
   * 現在選択されているモデルIDを取得
   * @returns モデルID
   */
  public getSelectedModel(): string | null {
    return this.selectedModelId;
  }
  
  /**
   * デフォルトモデルを取得
   * @returns デフォルトモデルのID
   */
  public getDefaultModel(): string | null {
    return this.selectedModelId;
  }
  
  /**
   * チャット完了のレスポンスを取得
   * @param messages メッセージ配列
   * @param modelId モデルID
   * @returns OpenAI API形式のレスポンス
   */
  public async getChatCompletion(
    messages: any[], 
    modelId: string
  ): Promise<OpenAIChatCompletionResponse> {
    try {
      // モデルが選択されていない場合
      if (!this.selectedModelId && modelId !== this.selectedModelId) {
        throw new Error('モデルが選択されていません。先にモデルを選択してください。');
      }
      
      // レート制限チェック
      const rateLimitError = limitsManager.checkRateLimit(modelId);
      if (rateLimitError) {
        const error = new Error(rateLimitError.message);
        (error as any).statusCode = 429; // Too Many Requests
        (error as any).type = 'rate_limit_error';
        throw error;
      }
      
      // トークン制限チェック
      const tokenLimitError = limitsManager.validateTokenLimit(messages, modelId);
      if (tokenLimitError) {
        const error = new Error(tokenLimitError.message);
        (error as any).statusCode = 400; // Bad Request
        (error as any).type = 'token_limit_error';
        throw error;
      }
      
      // メッセージをVSCode LM API形式に変換
      const vscodeLmMessages = messages.map(msg => {
        return new vscode.LanguageModelChatMessage(
          msg.role, 
          msg.content
        );
      });
      
      // VSCode LM APIを呼び出し
      const response = await vscode.lm.sendChatRequest(
        { id: modelId }, 
        vscodeLmMessages
      );
      
      // レスポンスをOpenAI API形式に変換
      return convertToOpenAIFormat(response, modelId);
    } catch (error) {
      console.error('Chat completion error:', error);
      throw error;
    }
  }
  
  /**
   * ストリーミングチャット完了のレスポンスを取得
   * @param messages メッセージ配列
   * @param modelId モデルID
   * @param callback チャンク処理コールバック
   */
  public async streamChatCompletion(
    messages: any[], 
    modelId: string,
    callback: (chunk: any) => void
  ): Promise<void> {
    try {
      // モデルが選択されていない場合
      if (!this.selectedModelId && modelId !== this.selectedModelId) {
        throw new Error('モデルが選択されていません。先にモデルを選択してください。');
      }
      
      // レート制限チェック
      const rateLimitError = limitsManager.checkRateLimit(modelId);
      if (rateLimitError) {
        const error = new Error(rateLimitError.message);
        (error as any).statusCode = 429; // Too Many Requests
        (error as any).type = 'rate_limit_error';
        throw error;
      }
      
      // トークン制限チェック
      const tokenLimitError = limitsManager.validateTokenLimit(messages, modelId);
      if (tokenLimitError) {
        const error = new Error(tokenLimitError.message);
        (error as any).statusCode = 400; // Bad Request
        (error as any).type = 'token_limit_error';
        throw error;
      }
      
      // メッセージをVSCode LM API形式に変換
      const vscodeLmMessages = messages.map(msg => {
        return new vscode.LanguageModelChatMessage(
          msg.role, 
          msg.content
        );
      });
      
      // VSCode LM APIを呼び出し（ストリーミングモード）
      const stream = await vscode.lm.sendChatRequestStream(
        { id: modelId }, 
        vscodeLmMessages
      );
      
      // ストリームを処理
      for await (const chunk of stream) {
        // チャンクをOpenAI API形式に変換してコールバックに渡す
        const openAIChunk = convertToOpenAIFormat(chunk, modelId, true);
        callback(openAIChunk);
      }
    } catch (error) {
      console.error('Streaming chat completion error:', error);
      throw error;
    }
  }

  /**
   * 特定のモデルファミリーをサポートしているかどうかをチェック
   * @param families モデルファミリーの配列
   * @returns サポートされている場合true
   */
  public async hasSupportedModels(families: string[]): Promise<boolean> {
    try {
      const models = await vscode.lm.selectChatModels({
        includeFamily: families
      });
      
      return models && models.length > 0;
    } catch (error) {
      console.error('モデルチェックエラー:', error);
      return false;
    }
  }
}

// シングルトンインスタンスをエクスポート
export const modelManager = new ModelManager();
