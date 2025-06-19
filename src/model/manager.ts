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
      let allModels: any[] = [];
      
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
        vscode.window.showWarningMessage('利用可能なモデルがありません');
        return undefined;
      }
      
      // モデル選択用のQuickPickアイテムを作成
      const quickPickItems = allModels.map(model => ({
        label: model.name || model.id,
        description: `${model.id} - ${model.vendor || '不明なベンダー'}`,
        detail: model.description || 'モデルの詳細情報はありません',
        model: model
      }));
      
      // QuickPickを使ってユーザーにモデルを選択させる
      const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: '使用するモデルを選択してください',
        canPickMany: false,
        matchOnDescription: true,
        matchOnDetail: true
      });
      
      if (!selectedItem) {
        // ユーザーが選択をキャンセルした場合
        return undefined;
      }
      
      // 選択されたモデルを保存
      this.selectedModelId = selectedItem.model.id;
      
      // モデル情報をログ出力
      console.log(`選択されたモデル: ${selectedItem.label} (${this.selectedModelId})`);
      
      return this.selectedModelId as string;
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
   * モデルIDを直接設定する
   * @param modelId 設定するモデルID
   */
  public setSelectedModel(modelId: string): void {
    this.selectedModelId = modelId;
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
      const [model] = await vscode.lm.selectChatModels({ id: modelId });
      if (!model) {
        throw new Error(`モデル ${modelId} が見つかりません`);
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
      const [model] = await vscode.lm.selectChatModels({ id: modelId });
      if (!model) {
        throw new Error(`モデル ${modelId} が見つかりません`);
      }
      
      // 新しいAPIでの実装
      const response = await model.sendRequest(
        vscodeLmMessages,
        {},
        new vscode.CancellationTokenSource().token
      );
      
      // 応答のストリームを取得
      const stream = response.text;
      
      // ストリームを処理
      for await (const chunk of stream) {
        // チャンクをOpenAI API形式に変換してコールバックに渡す
        const openAIChunk = convertToOpenAIFormat({ content: chunk, isComplete: false }, modelId, true);
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
      console.error('モデルチェックエラー:', error);
      return false;
    }
  }
}

// シングルトンインスタンスをエクスポート
export const modelManager = new ModelManager();
