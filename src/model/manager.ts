// モデル管理クラス
import * as vscode from 'vscode'
import { logger } from '../utils/logger'

/**
 * モデル管理クラス
 * VSCode Language Model APIへのアクセスとモデル選択を管理します。
 */
class ModelManager {
  // VSCode ExtensionContext（グローバルState用）
  private extensionContext: vscode.ExtensionContext | null = null
  /**
   * ExtensionContextをセット（グローバルState利用のため）
   */
  public setExtensionContext(context: vscode.ExtensionContext) {
    this.extensionContext = context

    // 起動時に保存済みモデル情報があれば復元
    const savedOpenAIModelId = context.globalState.get<string>('openaiModelId')
    if (savedOpenAIModelId) {
      this.openaiModelId = savedOpenAIModelId
    }

    const savedAnthropicModelId =
      context.globalState.get<string>('anthropicModelId')
    if (savedAnthropicModelId) {
      this.anthropicModelId = savedAnthropicModelId
    }

    const savedClaudeCodeBackgroundModelId = context.globalState.get<string>(
      'claudeCodeBackgroundModelId',
    )
    if (savedClaudeCodeBackgroundModelId) {
      this.claudeCodeBackgroundModelId = savedClaudeCodeBackgroundModelId
    }

    const savedClaudeCodeThinkingModelId = context.globalState.get<string>(
      'claudeCodeThinkingModelId',
    )
    if (savedClaudeCodeThinkingModelId) {
      this.claudeCodeThinkingModelId = savedClaudeCodeThinkingModelId
    }

    const savedGeminiModelId = context.globalState.get<string>('geminiModelId')
    if (savedGeminiModelId) {
      this.geminiModelId = savedGeminiModelId
    }
  }
  // 選択中のOpenAIモデルID
  private openaiModelId: string | null = null

  // 選択中のAnthropicモデルID
  private anthropicModelId: string | null = null

  // Claude Code Background Model
  private claudeCodeBackgroundModelId: string | null = null

  // Claude Code Thinking Model
  private claudeCodeThinkingModelId: string | null = null

  // 選択中のGeminiモデルID
  private geminiModelId: string | null = null

  // サポートするモデルファミリー
  private supportedFamilies = [
    'gpt-4o',
    'gpt-4o-mini',
    'o1',
    'o1-mini',
    'claude-3.5-sonnet',
  ]

  // OpenAIモデル変更時のイベントエミッター
  private readonly _onDidChangeOpenAIModelId = new vscode.EventEmitter<void>()
  public readonly onDidChangeOpenAIModelId =
    this._onDidChangeOpenAIModelId.event

  // Anthropicモデル変更時のイベントエミッター
  private readonly _onDidChangeAnthropicModelId =
    new vscode.EventEmitter<void>()
  public readonly onDidChangeAnthropicModelId =
    this._onDidChangeAnthropicModelId.event

  // Claude Code Background Model変更時のイベントエミッター
  private readonly _onDidChangeClaudeCodeBackgroundModelId =
    new vscode.EventEmitter<void>()
  public readonly onDidChangeClaudeCodeBackgroundModelId =
    this._onDidChangeClaudeCodeBackgroundModelId.event

  // Claude Code Thinking Model変更時のイベントエミッター
  private readonly _onDidChangeClaudeCodeThinkingModelId =
    new vscode.EventEmitter<void>()
  public readonly onDidChangeClaudeCodeThinkingModelId =
    this._onDidChangeClaudeCodeThinkingModelId.event

  // Geminiモデル変更時のイベントエミッター
  private readonly _onDidChangeGeminiModelId = new vscode.EventEmitter<void>()
  public readonly onDidChangeGeminiModelId =
    this._onDidChangeGeminiModelId.event

  /**
   * 利用可能なモデルからモデルを選択する
   * @param provider APIプロバイダー（'openAI' または 'anthropic'）
   * @returns 選択したモデルのID
   */
  public async selectModel(
    provider:
      | 'openAI'
      | 'anthropic'
      | 'claudeCodeBackground'
      | 'claudeCodeThinking'
      | 'gemini',
  ): Promise<string | undefined> {
    try {
      // サポートされているモデルが見つかるまで順番に試す
      let allModels: vscode.LanguageModelChat[] = []

      // まず、指定せずにすべてのモデルを取得してみる
      const defaultModels = await vscode.lm.selectChatModels({})
      if (defaultModels && defaultModels.length > 0) {
        allModels = defaultModels
      } else {
        // モデルが見つからなかった場合は、ファミリーごとに試行
        for (const family of this.supportedFamilies) {
          const familyModels = await vscode.lm.selectChatModels({ family })
          if (familyModels && familyModels.length > 0) {
            allModels = [...allModels, ...familyModels]
          }
        }
      }

      if (allModels.length === 0) {
        vscode.window.showWarningMessage('No available models found')
        return undefined
      }

      // モデル選択用のQuickPickアイテムを作成
      const quickPickItems = allModels.map(model => ({
        label: model.name,
        description: `${model.id} by ${model.vendor || 'Unknown vendor'}`,
        detail: `Max input tokens: ${model.maxInputTokens || 'Unknown'}, Version: ${model.version}`,
        model: model,
        // 右端に「Copy ID」テキストを追加
        buttons: [
          {
            iconPath: new vscode.ThemeIcon('copy'),
            tooltip: 'Copy model ID to clipboard',
          },
        ],
      }))

      // QuickPickを使ってユーザーにモデルを選択させる
      const quickPick = vscode.window.createQuickPick()
      quickPick.items = quickPickItems
      quickPick.placeholder = 'Select a model to use'
      quickPick.matchOnDescription = true
      quickPick.matchOnDetail = true

      // ボタンクリックのイベントハンドラを設定
      quickPick.onDidTriggerItemButton(event => {
        const modelId = (event.item as any).model.id
        vscode.env.clipboard.writeText(modelId)
        vscode.window.showInformationMessage(
          `Model ID "${modelId}" copied to clipboard`,
        )
      })

      // QuickPickを表示
      quickPick.show()

      // Promise化して結果を返す
      return new Promise<string | undefined>(resolve => {
        // モデル選択時の処理
        quickPick.onDidAccept(() => {
          const selectedItem = quickPick.selectedItems[0] as any
          if (selectedItem) {
            // providerによって保存先を分岐
            if (provider === 'openAI') {
              this.setOpenAIModelId(selectedItem.model.id)
              logger.info(`Selected OpenAI model: ${this.openaiModelId}`)
            } else if (provider === 'anthropic') {
              this.setAnthropicModelId(selectedItem.model.id)
              logger.info(`Selected Anthropic model: ${this.anthropicModelId}`)
            } else if (provider === 'claudeCodeBackground') {
              this.setClaudeCodeBackgroundModelId(selectedItem.model.id)
              logger.info(
                `Selected Claude Code Background model: ${this.claudeCodeBackgroundModelId}`,
              )
            } else if (provider === 'claudeCodeThinking') {
              this.setClaudeCodeThinkingModelId(selectedItem.model.id)
              logger.info(
                `Selected Claude Code Thinking model: ${this.claudeCodeThinkingModelId}`,
              )
            } else if (provider === 'gemini') {
              this.setGeminiModelId(selectedItem.model.id)
              logger.info(`Selected Gemini model: ${this.geminiModelId}`)
            }

            // QuickPickを閉じて選択結果を返す
            quickPick.dispose()
            resolve(selectedItem.model.id as string)
          } else {
            quickPick.dispose()
            resolve(undefined)
          }
        })

        // QuickPickがキャンセルされた場合の処理
        quickPick.onDidHide(() => {
          quickPick.dispose()
          resolve(undefined)
        })
      })
    } catch (error) {
      logger.error(
        `Model selection error: ${(error as Error).message}`,
        error as Error,
      )
      vscode.window.showErrorMessage(
        `Error selecting model: ${(error as Error).message}`,
      )
      return undefined
    }
  }

  /**
   * 現在選択されているモデルIDを取得
   * @returns モデルID
   */
  public getOpenAIModelId(): string | null {
    return this.openaiModelId
  }

  public getAnthropicModelId(): string | null {
    return this.anthropicModelId
  }

  public getClaudeCodeBackgroundModelId(): string | null {
    return this.claudeCodeBackgroundModelId
  }

  public getClaudeCodeThinkingModelId(): string | null {
    return this.claudeCodeThinkingModelId
  }

  public getGeminiModelId(): string | null {
    return this.geminiModelId
  }

  /**
   * モデルIDを直接設定する
   * @param modelId 設定するモデルID
   */
  public setOpenAIModelId(modelId: string): void {
    this.openaiModelId = modelId
    // 永続化
    if (this.extensionContext) {
      this.extensionContext.globalState.update(
        'openaiModelId',
        this.openaiModelId,
      )
    }
    // OpenAIモデル変更イベントを発火
    this._onDidChangeOpenAIModelId.fire()
  }

  /**
   * 選択中のAnthropicモデルIDをセット・保存
   */
  public setAnthropicModelId(modelId: string): void {
    this.anthropicModelId = modelId
    // 永続化
    if (this.extensionContext) {
      this.extensionContext.globalState.update(
        'anthropicModelId',
        this.anthropicModelId,
      )
    }
    // 必要ならイベント発火
    this._onDidChangeAnthropicModelId.fire()
  }

  /**
   * Claude Code Background Model IDをセット・保存
   */
  public setClaudeCodeBackgroundModelId(modelId: string): void {
    this.claudeCodeBackgroundModelId = modelId
    if (this.extensionContext) {
      this.extensionContext.globalState.update(
        'claudeCodeBackgroundModelId',
        this.claudeCodeBackgroundModelId,
      )
    }
    this._onDidChangeClaudeCodeBackgroundModelId.fire()
  }

  /**
   * Claude Code Thinking Model IDをセット・保存
   */
  public setClaudeCodeThinkingModelId(modelId: string): void {
    this.claudeCodeThinkingModelId = modelId
    if (this.extensionContext) {
      this.extensionContext.globalState.update(
        'claudeCodeThinkingModelId',
        this.claudeCodeThinkingModelId,
      )
    }
    this._onDidChangeClaudeCodeThinkingModelId.fire()
  }

  /**
   * 選択中のGeminiモデルIDをセット・保存
   */
  public setGeminiModelId(modelId: string): void {
    this.geminiModelId = modelId
    // 永続化
    if (this.extensionContext) {
      this.extensionContext.globalState.update(
        'geminiModelId',
        this.geminiModelId,
      )
    }
    // 必要ならイベント発火
    this._onDidChangeGeminiModelId.fire()
  }

  /**
   * デフォルトモデルを取得
   * @returns デフォルトモデルのID
   */
  public getDefaultModel(): string | null {
    return this.openaiModelId
  }

  /**
   * 利用可能なすべてのモデルを取得する
   * @returns VSCode LM APIから取得した生のモデルリスト
   */
  public async getAvailableModels(): Promise<vscode.LanguageModelChat[]> {
    try {
      // サポートされているモデルを取得
      let allModels: vscode.LanguageModelChat[] = []

      // まず、指定せずにすべてのモデルを取得
      const defaultModels = await vscode.lm.selectChatModels({})
      if (defaultModels && defaultModels.length > 0) {
        allModels = defaultModels
      } else {
        // モデルが見つからなかった場合は、ファミリーごとに試行
        for (const family of this.supportedFamilies) {
          const familyModels = await vscode.lm.selectChatModels({ family })
          if (familyModels && familyModels.length > 0) {
            allModels = [...allModels, ...familyModels]
          }
        }
      }

      return allModels
    } catch (error) {
      logger.error(
        `Get models error: ${(error as Error).message}`,
        error as Error,
      )
      throw error
    }
  }

  /**
   * 特定のモデル情報を取得する
   * @param modelId モデルID
   * @returns VSCode LMモデルインスタンスまたはプロキシモデルの場合はnull
   */
  public async getModelInfo(
    modelId: string,
  ): Promise<vscode.LanguageModelChat | null> {
    try {
      // vscode-lm-proxyの場合は特別扱い
      if (modelId === 'vscode-lm-proxy') {
        return null // プロキシモデルはVSCode LMモデルインスタンスを持たない
      }

      // 指定されたIDのモデルを取得
      const [model] = await vscode.lm.selectChatModels({ id: modelId })

      if (!model) {
        const error: any = new Error(`Model ${modelId} not found`)
        error.statusCode = 404
        error.type = 'model_not_found_error'
        throw error
      }

      return model
    } catch (error) {
      if ((error as any).statusCode === 404) {
        throw error
      }

      logger.error(
        `Get model info error: ${(error as Error).message}`,
        error as Error,
      )
      throw error
    }
  }
}

// シングルトンインスタンスをエクスポート
export const modelManager = new ModelManager()
