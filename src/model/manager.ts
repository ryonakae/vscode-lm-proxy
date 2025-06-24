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
    // ここで openaiModelId などの復元は不要（各 getter で取得する設計に統一）
  }

  // OpenAI APIで使用するモデル
  private openaiModelId: string | null = null;

  // Anthropic APIで使用するモデル
  private anthropicModelId: string | null = null;

  // Claude Code用のバックグラウンドモデル（haikuなど）
  private claudeBackgroundModelId: string | null = null;

  // Claude Code用のシンクモデル（sonnetなど）
  private claudeThinkModelId: string | null = null;
  
  // サポートするモデルファミリー
  private supportedFamilies = [
    'gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'claude-3.5-sonnet'
  ];

  // モデル変更時のイベントエミッター
  private readonly _onDidChangeSelectedModel = new vscode.EventEmitter<void>();
  public readonly onDidChangeSelectedModel = this._onDidChangeSelectedModel.event;

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
            // ここでは何も保存しない（モデル選択UIのみ）
            logger.info(`Selected model: ${selectedItem.model.name} (${selectedItem.model.id})`);
            quickPick.dispose();
            resolve(selectedItem.model.id as string);
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
  
  /**
   * 現在選択されているモデル名を取得
   * @returns モデル名
   */
  
  /**
   * モデルIDを直接設定する
   * @param modelId 設定するモデルID
   * @param modelName 設定するモデル名（省略時はモデルIDと同じ）
   */
  
  /**
   * デフォルトモデルを取得
   * @returns デフォルトモデルのID
   */
  // getDefaultModelは不要になったため削除

  /**
   * OpenAI API用に設定されているモデルを取得
   * @returns OpenAI API用モデルID
   */
  public getOpenaiModelId(): string {
    if (!this.extensionContext) {
      return 'vscode-lm-proxy';
    }
    return this.extensionContext.globalState.get<string>('openaiModelId') || 'vscode-lm-proxy';
  }
  
  /**
   * OpenAI API用のモデルを設定
   * @param modelId 設定するモデルID
   * @param modelName モデル名（オプション）
   */
  public setOpenaiModelId(modelId: string, modelName?: string): void {
    if (!this.extensionContext) {
      return;
    }
    this.openaiModelId = modelId;
    this.extensionContext.globalState.update('openaiModelId', modelId);
    if (modelName) {
      this.extensionContext.globalState.update('openaiModelName', modelName);
    }
  }
  
  /**
   * Anthropic API用に設定されているモデルを取得
   * @returns Anthropic API用モデルID
   */
  public getAnthropicModelId(): string {
    if (!this.extensionContext) {
      return 'vscode-lm-proxy';
    }
    return this.extensionContext.globalState.get<string>('anthropicModelId') || 'vscode-lm-proxy';
  }
  
  /**
   * Anthropic API用のモデルを設定
   * @param modelId 設定するモデルID
   * @param modelName モデル名（オプション）
   */
  public setAnthropicModelId(modelId: string, modelName?: string): void {
    if (!this.extensionContext) {
      return;
    }
    this.anthropicModelId = modelId;
    this.extensionContext.globalState.update('anthropicModelId', modelId);
    if (modelName) {
      this.extensionContext.globalState.update('anthropicModelName', modelName);
    }
  }
  
  /**
   * Claude Codeバックグラウンド用モデルを取得
   * @returns Claude Codeバックグラウンド用モデルID
   */
  public getClaudeBackgroundModelId(): string {
    if (!this.extensionContext) {
      return 'vscode-lm-proxy';
    }
    return this.extensionContext.globalState.get<string>('claudeBackgroundModelId') || 'vscode-lm-proxy';
  }
  
  /**
   * Claude Codeバックグラウンド用モデルを設定
   * @param modelId 設定するモデルID
   * @param modelName モデル名（オプション）
   */
  public setClaudeBackgroundModelId(modelId: string, modelName?: string): void {
    if (!this.extensionContext) {
      return;
    }
    this.claudeBackgroundModelId = modelId;
    this.extensionContext.globalState.update('claudeBackgroundModelId', modelId);
    if (modelName) {
      this.extensionContext.globalState.update('claudeBackgroundModelName', modelName);
    }
  }
  
  /**
   * Claude Codeシンク用モデルを取得
   * @returns Claude Codeシンク用モデルID
   */
  public getClaudeThinkModelId(): string {
    if (!this.extensionContext) {
      return 'vscode-lm-proxy';
    }
    return this.extensionContext.globalState.get<string>('claudeThinkModelId') || 'vscode-lm-proxy';
  }
  
  /**
   * Claude Codeシンク用モデルを設定
   * @param modelId 設定するモデルID
   * @param modelName モデル名（オプション）
   */
  public setClaudeThinkModelId(modelId: string, modelName?: string): void {
    if (!this.extensionContext) {
      return;
    }
    this.claudeThinkModelId = modelId;
    this.extensionContext.globalState.update('claudeThinkModelId', modelId);
    if (modelName) {
      this.extensionContext.globalState.update('claudeThinkModelName', modelName);
    }
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
      // vscode-lm-proxyの場合は openaiModelId などを使用
      const actualModelId = modelId === 'vscode-lm-proxy' ? this.getOpenaiModelId() : modelId;

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
      // vscode-lm-proxyの場合は openaiModelId などを使用
      const actualModelId = modelId === 'vscode-lm-proxy' ? this.getOpenaiModelId() : modelId;
      
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
      // vscode-lm-proxyの場合は選択されたモデルを使用
      const actualModelId = modelId === 'vscode-lm-proxy' ? this.getOpenaiModelId() : modelId;
      
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
      // vscode-lm-proxyの場合は選択されたモデルを使用
      const actualModelId = modelId === 'vscode-lm-proxy' ? this.getOpenaiModelId() : modelId;
      
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
   * @returns VSCode LM APIから取得した利用可能なLanguageModelChatモデルの配列
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
      
      // モデル配列をそのまま返す
      return allModels;
    } catch (error) {
      logger.error(`Get models error: ${(error as Error).message}`, error as Error);
      return [];
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

  /**
   * Claude Codeリクエストからモデル名をマッピングして適切なモデルを選択する
   * @param requestedModel リクエストされたモデル名
   * @returns 実際に使用するモデルID
   */
  public mapClaudeCodeModel(requestedModel: string): string {
    // VSCode設定からモデルを取得
    const config = vscode.workspace.getConfiguration('vscode-lm-proxy');
    
    // モデル名に基づきマッピングを行う
    if (requestedModel.includes('haiku')) {
      // バックグラウンドモデル（軽量処理用）
      this.claudeBackgroundModelId = config.get('claudeBackgroundModel') || this.getClaudeBackgroundModelId();
      return this.claudeBackgroundModelId || 'vscode-lm-proxy';
    } else if (requestedModel.includes('sonnet')) {
      // シンクモデル（重要処理用）
      this.claudeThinkModelId = config.get('claudeThinkModel') || this.getClaudeThinkModelId();
      return this.claudeThinkModelId || 'vscode-lm-proxy';
    }
    
    // デフォルトはAnthropicモデルを使用
    this.anthropicModelId = config.get('anthropicModel') || this.getAnthropicModelId();
    return this.anthropicModelId || 'vscode-lm-proxy';
  }

  /**
   * OpenAI API用のモデルを取得
   * @returns 使用するモデルID
   */
  public getOpenAIModel(): string {
    if (this.openaiModelId === null) {
      const config = vscode.workspace.getConfiguration('vscode-lm-proxy');
      this.openaiModelId = config.get('openaiModel') || this.getOpenaiModelId();
    }
    return this.openaiModelId || this.getOpenaiModelId();
  }

  /**
   * Anthropic API用のモデルを取得
   * @returns 使用するモデルID
   */
  public getAnthropicModel(): string {
    if (this.anthropicModelId === null) {
      const config = vscode.workspace.getConfiguration('vscode-lm-proxy');
      this.anthropicModelId = config.get('anthropicModel') || this.getAnthropicModelId();
    }
    return this.anthropicModelId || this.getAnthropicModelId();
  }

  /**
   * Claude Code用のバックグラウンドモデル（haiku）を取得
   * @returns 使用するモデルID
   */
  public getClaudeBackgroundModel(): string {
    if (this.claudeBackgroundModelId === null) {
      const config = vscode.workspace.getConfiguration('vscode-lm-proxy');
      this.claudeBackgroundModelId = config.get('claudeBackgroundModel') || this.getClaudeBackgroundModelId();
    }
    return this.claudeBackgroundModelId || this.getClaudeBackgroundModelId();
  }

  /**
   * Claude Code用のシンクモデル（sonnet）を取得
   * @returns 使用するモデルID
   */
  public getClaudeThinkModel(): string {
    if (this.claudeThinkModelId === null) {
      const config = vscode.workspace.getConfiguration('vscode-lm-proxy');
      this.claudeThinkModelId = config.get('claudeThinkModel') || this.getClaudeThinkModelId();
    }
    return this.claudeThinkModelId || this.getClaudeThinkModelId();
  }
}

// シングルトンインスタンスをエクスポート
export const modelManager = new ModelManager();
