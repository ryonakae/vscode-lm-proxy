// モデル管理クラス
import * as vscode from 'vscode';
import { convertToOpenAIFormat } from './converter';
import { OpenAIChatCompletionResponse } from './types';
import { limitsManager } from './limits';
import { logger } from '../utils/logger';

/**
 * モデル管理クラス
 * VSCode Language Model APIへのアクセスとモデル選択を管理
 */
class ModelManager {
  // 選択されたモデルID
  private selectedModelId: string | null = null;
  
  // 選択されたモデル名
  private selectedModelName: string | null = null;
  
  // サポートするモデルファミリー
  private supportedFamilies = [
    'gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'claude-3.5-sonnet'
  ];

  /**
   * AsyncIterableなストリームを文字列に変換
   * @param stream 文字列のAsyncIterable
   * @returns 連結された文字列
   */
  private async streamToString(stream: AsyncIterable<string>): Promise<string> {
    let result = '';
    for await (const chunk of stream) {
      result += chunk;
    }
    return result;
  }

  /**
   * 利用可能なモデルからモデルを選択する
   * @returns 選択したモデルのID
   */
  public async selectModel(): Promise<string | undefined> {
    try {
      // サポートされているモデルが見つかるまで順番に試す
      let allModels: vscode.LanguageModelChat[] = [];
      
      // まず、指定せずにすべてのモデルを取得してみる
      const defaultModels = await vscode.lm.selectChatModels({});
      if (defaultModels && defaultModels.length > 0) {
        allModels = defaultModels;
      } else {
        // モデルが見つからなかった場合は、ファミリーごとに試行
        for (const family of this.supportedFamilies) {
          const familyModels = await vscode.lm.selectChatModels({ family });
          if (familyModels && familyModels.length > 0) {
            allModels = [...allModels, ...familyModels];
          }
        }
      }
      
      if (allModels.length === 0) {
        vscode.window.showWarningMessage('No available models found');
        return undefined;
      }
      
      // モデル選択用のQuickPickアイテムを作成
      const quickPickItems = allModels.map(model => ({
        label: model.name || model.id,
        description: `${model.version} by ${model.vendor || 'Unknown vendor'}`,
        detail: `Max input tokens: ${model.maxInputTokens || 'Unknown'}`,
        model: model
      }));
      
      // QuickPickを使ってユーザーにモデルを選択させる
      const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: 'Select a model to use',
        canPickMany: false,
        matchOnDescription: true,
        matchOnDetail: true
      });
      
      if (!selectedItem) {
        // ユーザーが選択をキャンセルした場合
        return undefined;
      }
      
      // 選択されたモデルのIDとモデル名を保存
      this.selectedModelId = selectedItem.model.id;
      this.selectedModelName = selectedItem.model.name || selectedItem.model.id;
      
      // モデル情報をログ出力
      logger.info(`Selected model: ${this.selectedModelName} (${this.selectedModelId})`);
      
      return this.selectedModelId as string;
    } catch (error) {
      logger.error(`モデル選択エラー: ${(error as Error).message}`, error as Error);
      vscode.window.showErrorMessage(`Error selecting model: ${(error as Error).message}`);
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
   * 現在選択されているモデル名を取得
   * @returns モデル名
   */
  public getSelectedModelName(): string | null {
    return this.selectedModelName;
  }
  
  /**
   * モデルIDを直接設定する
   * @param modelId 設定するモデルID
   * @param modelName 設定するモデル名（省略時はモデルIDと同じ）
   */
  public setSelectedModel(modelId: string, modelName?: string): void {
    this.selectedModelId = modelId;
    this.selectedModelName = modelName || modelId;
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
      // vscode-lm-proxyの場合は選択されたモデルを使用
      const actualModelId = modelId === 'vscode-lm-proxy' ? this.selectedModelId : modelId;
      
      // モデルが選択されていない場合
      if (!actualModelId) {
        throw new Error('No model selected. Please select a model first.');
      }
      
      // レート制限チェック
      const rateLimitError = limitsManager.checkRateLimit(actualModelId);
      if (rateLimitError) {
        const error = new Error(rateLimitError.message);
        (error as any).statusCode = 429; // Too Many Requests
        (error as any).type = 'rate_limit_error';
        throw error;
      }
      
      // トークン制限チェック
      const tokenLimitError = limitsManager.validateTokenLimit(messages, actualModelId);
      if (tokenLimitError) {
        const error = new Error(tokenLimitError.message);
        (error as any).statusCode = 400; // Bad Request
        (error as any).type = 'token_limit_error';
        throw error;
      }
      
      // メッセージをVSCode LM API形式に変換
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
      
      // VSCode LM APIを呼び出し
      // 最新のAPIではモデルを取得してからリクエストを送信
      const [model] = await vscode.lm.selectChatModels({ id: actualModelId });
      if (!model) {
        throw new Error(`Model ${actualModelId} not found`);
      }
      
      const response = await model.sendRequest(
        vscodeLmMessages,
        {},
        new vscode.CancellationTokenSource().token
      );
      
      // レスポンスをOpenAI API形式に変換
      // 新しいAPIは直接テキストを返さないため、ストリーミング処理として扱う
      const responseText = await this.streamToString(response.text);
      return convertToOpenAIFormat({ content: responseText, isComplete: true }, modelId) as OpenAIChatCompletionResponse;
    } catch (error) {
      logger.error('Chat completion error:', error as Error);
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
      // vscode-lm-proxyの場合は選択されたモデルを使用
      const actualModelId = modelId === 'vscode-lm-proxy' ? this.selectedModelId : modelId;
      
      // モデルが選択されていない場合
      if (!actualModelId) {
        throw new Error('No model selected. Please select a model first.');
      }
      
      // レート制限チェック
      const rateLimitError = limitsManager.checkRateLimit(actualModelId);
      if (rateLimitError) {
        const error = new Error(rateLimitError.message);
        (error as any).statusCode = 429; // Too Many Requests
        (error as any).type = 'rate_limit_error';
        throw error;
      }
      
      // トークン制限チェック
      const tokenLimitError = limitsManager.validateTokenLimit(messages, actualModelId);
      if (tokenLimitError) {
        const error = new Error(tokenLimitError.message);
        (error as any).statusCode = 400; // Bad Request
        (error as any).type = 'token_limit_error';
        throw error;
      }
      
      // メッセージをVSCode LM API形式に変換
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
      
      // VSCode LM APIを呼び出し（ストリーミングモード）
      // 最新のAPIではモデルを取得してからリクエストを送信
      const [model] = await vscode.lm.selectChatModels({ id: actualModelId });
      if (!model) {
        throw new Error(`Model ${actualModelId} not found`);
      }
      
      // 新しいAPIでの実装
      const response = await model.sendRequest(
        vscodeLmMessages,
        {},
        new vscode.CancellationTokenSource().token
      );
      
      // 応答のストリームを取得
      const stream = response.text;
      
      // 最初のチャンクで役割を送信
      let firstChunk = true;
      let lastContent = '';
      
      // ストリームを処理
      for await (const chunk of stream) {
        lastContent = chunk; // 最後のコンテンツを記録
        
        // チャンクをOpenAI API形式に変換してコールバックに渡す
        const openAIChunk = convertToOpenAIFormat(
          { 
            content: firstChunk ? '' : chunk, 
            isComplete: false 
          }, 
          modelId, 
          true
        );
        
        // 最初のチャンクのフラグをリセット
        if (firstChunk) {
          firstChunk = false;
          // 最初の空のチャンクを送信（role: "assistant"を含む）
          callback(openAIChunk);
          
          // 続いて実際のコンテンツを含むチャンクを送信
          if (chunk) {
            const contentChunk = convertToOpenAIFormat({ content: chunk, isComplete: false }, modelId, true);
            callback(contentChunk);
            continue;
          }
        } else {
          callback(openAIChunk);
        }
      }
      
      // 完了チャンクを送信
      const finishChunk = convertToOpenAIFormat(
        { content: '', isComplete: true },
        modelId,
        true
      );
      callback(finishChunk);
    } catch (error) {
      logger.error('Streaming chat completion error:', error as Error);
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
      // 各ファミリーごとに個別に確認する
      for (const family of families) {
        const models = await vscode.lm.selectChatModels({
          family: family
        });
        
        if (models && models.length > 0) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      logger.error('モデルチェックエラー:', error as Error);
      return false;
    }
  }
}

// シングルトンインスタンスをエクスポート
export const modelManager = new ModelManager();
