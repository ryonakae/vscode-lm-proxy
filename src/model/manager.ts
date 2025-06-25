// モデル管理クラス
import * as vscode from 'vscode';
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
    const savedOpenAIModelId = context.globalState.get<string>('openaiModelId');
    if (savedOpenAIModelId) {
      this.openaiModelId = savedOpenAIModelId;
    }
  }
  // 選択中のOpenAIモデルID
  private openaiModelId: string | null = null;
  
  // サポートするモデルファミリー
  private supportedFamilies = [
    'gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'claude-3.5-sonnet'
  ];

  // OpenAIモデル変更時のイベントエミッター
  private readonly _onDidChangeOpenAIModelId = new vscode.EventEmitter<void>();
  public readonly onDidChangeOpenAIModelId = this._onDidChangeOpenAIModelId.event;

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
            this.setOpenAIModelId(selectedItem.model.id);
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
  public getOpenAIModelId(): string | null {
    return this.openaiModelId;
  }
  
  /**
   * モデルIDを直接設定する
   * @param modelId 設定するモデルID
   */
  public setOpenAIModelId(modelId: string): void {
    this.openaiModelId = modelId;
    // 永続化
    if (this.extensionContext) {
      this.extensionContext.globalState.update('openaiModelId', this.openaiModelId);
    }
    // OpenAIモデル変更イベントを発火
    this._onDidChangeOpenAIModelId.fire();
  }
  
  /**
   * デフォルトモデルを取得
   * @returns デフォルトモデルのID
   */
  public getDefaultModel(): string | null {
    return this.openaiModelId;
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
