// モデル管理クラス
import * as vscode from 'vscode';
import { convertToOpenAIFormat } from './openaiConverter';
import { OpenAIChatCompletionResponse } from './types';
import { limitsManager } from './limits';
import { logger } from '../utils/logger';

/**
 * モデル管理クラス
 * VSCode Language Model APIへのアクセスとモデル選択を管理
 */
class ModelManager {
  // VSCode ExtensionContext（グローバルState用）
  private extensionContext: vscode.ExtensionContext | null = null;
  /**
   * ExtensionContextをセット（グローバルState利用のため）
   */
  public setExtensionContext(context: vscode.ExtensionContext) {
    this.extensionContext = context;
    // 起動時に保存済みモデル情報があれば復元
    const savedOpenaiModelId = context.globalState.get<string>('openaiModelId');
    if (savedOpenaiModelId) {
      this.openaiModelId = savedOpenaiModelId;
    }
  }
  // 選択中のOpenAIモデルID
  private openaiModelId: string | null = null;
  
  // サポートするモデルファミリー
  private supportedFamilies = [
    'gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'claude-3.5-sonnet'
  ];

  // OpenAIモデル変更時のイベントエミッター
  private readonly _onDidChangeOpenaiModelId = new vscode.EventEmitter<void>();
  public readonly onDidChangeOpenaiModelId = this._onDidChangeOpenaiModelId.event;

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
        label: model.name,
        description: `${model.id} by ${model.vendor || 'Unknown vendor'}`,
        detail: `Max input tokens: ${model.maxInputTokens || 'Unknown'}, Version: ${model.version}`,
        model: model,
        // 右端に「Copy ID」テキストを追加
        buttons: [{ 
          iconPath: new vscode.ThemeIcon('copy'),
          tooltip: 'Copy model ID to clipboard' 
        }]
      }));
      
      // QuickPickを使ってユーザーにモデルを選択させる
      const quickPick = vscode.window.createQuickPick();
      quickPick.items = quickPickItems;
      quickPick.placeholder = 'Select a model to use';
      quickPick.matchOnDescription = true;
      quickPick.matchOnDetail = true;
      
      // ボタンクリックのイベントハンドラを設定
      quickPick.onDidTriggerItemButton(event => {
        const modelId = (event.item as any).model.id;
        vscode.env.clipboard.writeText(modelId);
        vscode.window.showInformationMessage(`Model ID "${modelId}" copied to clipboard`);
      });

      // QuickPickを表示
      quickPick.show();
      
      // Promise化して結果を返す
      return new Promise<string | undefined>((resolve) => {
        // モデル選択時の処理
        quickPick.onDidAccept(() => {
          const selectedItem = quickPick.selectedItems[0] as any;
          if (selectedItem) {
            // 選択されたモデルのIDとモデル名を保存
            this.setOpenaiModelId(selectedItem.model.id);
            logger.info(`Selected model: ${this.openaiModelId}`);
            quickPick.dispose();
            resolve(this.openaiModelId as string);
          } else {
            quickPick.dispose();
            resolve(undefined);
          }
        });
        
        // QuickPickがキャンセルされた場合の処理
        quickPick.onDidHide(() => {
          quickPick.dispose();
          resolve(undefined);
        });
      });
    } catch (error) {
      logger.error(`Model selection error: ${(error as Error).message}`, error as Error);
      vscode.window.showErrorMessage(`Error selecting model: ${(error as Error).message}`);
      return undefined;
    }
  }

  /**
   * 現在選択されているモデルIDを取得
   * @returns モデルID
   */
  public getOpenaiModelId(): string | null {
    return this.openaiModelId;
  }
  
  /**
   * モデルIDを直接設定する
   * @param modelId 設定するモデルID
   */
  public setOpenaiModelId(modelId: string): void {
    this.openaiModelId = modelId;
    // 永続化
    if (this.extensionContext) {
      this.extensionContext.globalState.update('openaiModelId', this.openaiModelId);
    }
    // OpenAIモデル変更イベントを発火
    this._onDidChangeOpenaiModelId.fire();
  }
  
  /**
   * デフォルトモデルを取得
   * @returns デフォルトモデルのID
   */
  public getDefaultModel(): string | null {
    return this.openaiModelId;
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
      // vscode-lm-proxyの場合は選択中のOpenAIモデルを使用
      const actualModelId = modelId === 'vscode-lm-proxy' ? this.openaiModelId : modelId;
      
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
      const tokenLimitError = await limitsManager.validateTokenLimit(messages, actualModelId);
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

      // プロンプトのトークン数を計算 - 各メッセージを個別に計算して合計
      let promptTokens = 0;
      for (const message of vscodeLmMessages) {
        promptTokens += await model.countTokens(message);
      }
      
      const response = await model.sendRequest(
        vscodeLmMessages,
        {},
        new vscode.CancellationTokenSource().token
      );
      
      // レスポンスをOpenAI API形式に変換
      // 新しいAPIは直接テキストを返さないため、ストリーミング処理として扱う
      const responseText = await this.streamToString(response.text);
      
      // レスポンスのトークン数を計算
      const responseMessage = vscode.LanguageModelChatMessage.Assistant(responseText);
      const completionTokens = await model.countTokens(responseMessage);
      
      const openAIResponse = convertToOpenAIFormat({ content: responseText, isComplete: true }, modelId) as OpenAIChatCompletionResponse;
      
      // トークン数情報を更新
      openAIResponse.usage = {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
        prompt_tokens_details: {
          cached_tokens: 0,
          audio_tokens: 0
        },
        completion_tokens_details: {
          reasoning_tokens: completionTokens,
          audio_tokens: 0,
          accepted_prediction_tokens: 0,
          rejected_prediction_tokens: 0
        }
      };
      
      return openAIResponse;
    } catch (error) {
      logger.error('Chat completion error:', error as Error);
      throw error;
    }
  }
  
  /**
   * システムプロンプト付きのチャット完了レスポンスを取得
   * @param messages メッセージ配列
   * @param modelId モデルID
   * @param systemPrompt システムプロンプト（省略可）
   * @returns OpenAI API形式のレスポンス
   */
  public async getChatCompletionWithSystem(
    messages: any[], 
    modelId: string,
    systemPrompt?: string
  ): Promise<OpenAIChatCompletionResponse> {
    try {
      // vscode-lm-proxyの場合は選択中のOpenAIモデルを使用
      const actualModelId = modelId === 'vscode-lm-proxy' ? this.openaiModelId : modelId;
      
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
      const tokenLimitError = await limitsManager.validateTokenLimit(messages, actualModelId);
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
      const [model] = await vscode.lm.selectChatModels({ id: actualModelId });
      if (!model) {
        throw new Error(`Model ${actualModelId} not found`);
      }

      // プロンプトのトークン数を計算 - 各メッセージを個別に計算して合計
      let promptTokens = 0;
      for (const message of vscodeLmMessages) {
        promptTokens += await model.countTokens(message);
      }
      
      // システムプロンプトがあれば、先頭にユーザーメッセージとして追加
      if (systemPrompt) {
        // 従来のAPIではシステムプロンプトに専用の型がないため、ユーザーメッセージとして扱う
        const systemMessage = vscode.LanguageModelChatMessage.User(`[System Instructions] ${systemPrompt}`);
        vscodeLmMessages.unshift(systemMessage);
      }
      
      const response = await model.sendRequest(
        vscodeLmMessages,
        {},
        new vscode.CancellationTokenSource().token
      );
      
      // レスポンスをOpenAI API形式に変換
      // 新しいAPIは直接テキストを返さないため、ストリーミング処理として扱う
      const responseText = await this.streamToString(response.text);
      
      // レスポンスのトークン数を計算
      const responseMessage = vscode.LanguageModelChatMessage.Assistant(responseText);
      const completionTokens = await model.countTokens(responseMessage);
      
      const openAIResponse = convertToOpenAIFormat({ content: responseText, isComplete: true }, modelId) as OpenAIChatCompletionResponse;
      
      // トークン数情報を更新
      openAIResponse.usage = {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
        prompt_tokens_details: {
          cached_tokens: 0,
          audio_tokens: 0
        },
        completion_tokens_details: {
          reasoning_tokens: completionTokens,
          audio_tokens: 0,
          accepted_prediction_tokens: 0,
          rejected_prediction_tokens: 0
        }
      };
      
      return openAIResponse;
    } catch (error) {
      logger.error('Chat completion with system error:', error as Error);
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
      // vscode-lm-proxyの場合は選択中のOpenAIモデルを使用
      const actualModelId = modelId === 'vscode-lm-proxy' ? this.openaiModelId : modelId;
      
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
      const tokenLimitError = await limitsManager.validateTokenLimit(messages, actualModelId);
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
      
      // ストリーミング全体の内容を累積するための変数
      let accumulatedContent = '';
      
      // ストリーミング開始のログ出力を無効化
      // logger.info(`[STREAM] Started streaming response for ${modelId}`);
      
      // ストリームを処理
      for await (const chunk of stream) {
        lastContent = chunk; // 最後のコンテンツを記録
        accumulatedContent += chunk; // 累積コンテンツに追加
        
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
        
        // 細かいチャンクのログ出力を無効化（全体の応答のみログに出力）
        // logger.info(`[STREAM_CONTENT] ${JSON.stringify(chunk)}`); // 以前はここでチャンクごとのログを出力
      }
      
      // プロンプトのトークン数を計算 - 各メッセージを個別に計算して合計
      let promptTokens = 0;
      for (const message of vscodeLmMessages) {
        promptTokens += await model.countTokens(message);
      }
      
      // レスポンスのトークン数を計算
      const responseMessage = vscode.LanguageModelChatMessage.Assistant(lastContent);
      const completionTokens = await model.countTokens(responseMessage);
      
      // 完了チャンクを送信 - トークン数情報を含める
      const finishChunk = convertToOpenAIFormat(
        { content: '', isComplete: true },
        modelId,
        true
      ) as OpenAIChatCompletionResponse;
      
      // トークン数情報を更新
      finishChunk.usage = {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
        prompt_tokens_details: {
          cached_tokens: 0,
          audio_tokens: 0
        },
        completion_tokens_details: {
          reasoning_tokens: completionTokens,
          audio_tokens: 0,
          accepted_prediction_tokens: 0,
          rejected_prediction_tokens: 0
        }
      };
      
      callback(finishChunk);
      
      // ストリーミング完了後、累積した全体の内容をフォーマットしてログに出力
      logger.info(`[STREAM_RESPONSE_COMPLETE] ============= Full Response =============\n${accumulatedContent}\n============= End of Response =============`);
    } catch (error) {
      logger.error('Streaming chat completion error:', error as Error);
      throw error;
    }
  }

  /**
   * システムプロンプト付きのストリーミングチャット完了レスポンスを取得
   * @param messages メッセージ配列
   * @param modelId モデルID
   * @param callback チャンク処理コールバック
   * @param systemPrompt システムプロンプト（省略可）
   */
  public async streamChatCompletionWithSystem(
    messages: any[], 
    modelId: string,
    callback: (chunk: any) => void,
    systemPrompt?: string
  ): Promise<void> {
    try {
      // vscode-lm-proxyの場合は選択中のOpenAIモデルを使用
      const actualModelId = modelId === 'vscode-lm-proxy' ? this.openaiModelId : modelId;
      
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
      const tokenLimitError = await limitsManager.validateTokenLimit(messages, actualModelId);
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
      const [model] = await vscode.lm.selectChatModels({ id: actualModelId });
      if (!model) {
        throw new Error(`Model ${actualModelId} not found`);
      }
      
      // システムプロンプトがあれば、先頭にユーザーメッセージとして追加
      if (systemPrompt) {
        // 従来のAPIではシステムプロンプトに専用の型がないため、ユーザーメッセージとして扱う
        const systemMessage = vscode.LanguageModelChatMessage.User(`[System Instructions] ${systemPrompt}`);
        vscodeLmMessages.unshift(systemMessage);
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
      
      // ストリーミング全体の内容を累積するための変数
      let accumulatedContent = '';
      
      // ストリームを処理
      for await (const chunk of stream) {
        lastContent = chunk; // 最後のコンテンツを記録
        accumulatedContent += chunk; // 累積コンテンツに追加
        
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
      
      // プロンプトのトークン数を計算 - 各メッセージを個別に計算して合計
      let promptTokens = 0;
      for (const message of vscodeLmMessages) {
        promptTokens += await model.countTokens(message);
      }
      
      // レスポンスのトークン数を計算
      const responseMessage = vscode.LanguageModelChatMessage.Assistant(lastContent);
      const completionTokens = await model.countTokens(responseMessage);
      
      // 完了チャンクを送信 - トークン数情報を含める
      const finishChunk = convertToOpenAIFormat(
        { content: '', isComplete: true },
        modelId,
        true
      ) as OpenAIChatCompletionResponse;
      
      // トークン数情報を更新
      finishChunk.usage = {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
        prompt_tokens_details: {
          cached_tokens: 0,
          audio_tokens: 0
        },
        completion_tokens_details: {
          reasoning_tokens: completionTokens,
          audio_tokens: 0,
          accepted_prediction_tokens: 0,
          rejected_prediction_tokens: 0
        }
      };
      
      callback(finishChunk);
      
      // ストリーミング完了後、累積した全体の内容をフォーマットしてログに出力
      logger.info(`[STREAM_RESPONSE_COMPLETE] ============= Full Response =============\n${accumulatedContent}\n============= End of Response =============`);
    } catch (error) {
      logger.error('Streaming chat completion with system error:', error as Error);
      throw error;
    }
  }

  /**
   * 利用可能なすべてのモデルを取得する
   * @returns VSCode LM APIから取得した生のモデルリスト
   */
  public async getAvailableModels(): Promise<vscode.LanguageModelChat[]> {
    try {
      // サポートされているモデルを取得
      let allModels: vscode.LanguageModelChat[] = [];
      
      // まず、指定せずにすべてのモデルを取得
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
      
      return allModels;
    } catch (error) {
      logger.error(`Get models error: ${(error as Error).message}`, error as Error);
      throw error;
    }
  }
  
  /**
   * 特定のモデル情報を取得する
   * @param modelId モデルID
   * @returns VSCode LMモデルインスタンスまたはプロキシモデルの場合はnull
   */
  public async getModelInfo(modelId: string): Promise<vscode.LanguageModelChat | null> {
    try {
      // vscode-lm-proxyの場合は特別扱い
      if (modelId === 'vscode-lm-proxy') {
        return null; // プロキシモデルはVSCode LMモデルインスタンスを持たない
      }
      
      // 指定されたIDのモデルを取得
      const [model] = await vscode.lm.selectChatModels({ id: modelId });
      
      if (!model) {
        const error: any = new Error(`Model ${modelId} not found`);
        error.statusCode = 404;
        error.type = 'model_not_found_error';
        throw error;
      }
      
      return model;
    } catch (error) {
      if ((error as any).statusCode === 404) {
        throw error;
      }
      
      logger.error(`Get model info error: ${(error as Error).message}`, error as Error);
      throw error;
    }
  }
}

// シングルトンインスタンスをエクスポート
export const modelManager = new ModelManager();
