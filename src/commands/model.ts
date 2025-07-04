// モデル選択コマンド
import * as vscode from 'vscode'
import { modelManager } from '../model/manager'
import { serverManager } from '../server/manager'
import { statusBarManager } from '../ui/statusbar'

/**
 * モデル選択関連のコマンド（選択・再起動）をVSCodeに登録します。
 * @param {vscode.ExtensionContext} context 拡張機能のグローバルコンテキスト
 */
export function registerModelCommands(context: vscode.ExtensionContext): void {
  // OpenAI APIモデル選択コマンド
  const selectOpenAIModelCommand = vscode.commands.registerCommand(
    'vscode-lm-proxy.selectOpenAIModel',
    async () => {
      try {
        // モデル選択ダイアログを表示
        const openaiModelId = await modelManager.selectModel('openAI')

        if (openaiModelId) {
          // モデルIDを設定
          context.globalState.update('openaiModelId', openaiModelId)
          vscode.window.showInformationMessage(
            `OpenAI Model selected: ${openaiModelId}`,
          )
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error selecting model: ${(error as Error).message}`,
        )
      }
    },
  )

  // Anthropicモデル選択コマンド
  const selectAnthropicModelCommand = vscode.commands.registerCommand(
    'vscode-lm-proxy.selectAnthropicModel',
    async () => {
      try {
        // モデル選択ダイアログを表示
        const anthropicModelId = await modelManager.selectModel('anthropic')

        if (anthropicModelId) {
          // モデルIDを設定
          context.globalState.update('anthropicModelId', anthropicModelId)
          vscode.window.showInformationMessage(
            `Anthropic Model selected: ${anthropicModelId}`,
          )
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error selecting Anthropic model: ${(error as Error).message}`,
        )
      }
    },
  )

  // Claude Code Backgroundモデル選択コマンド
  const selectClaudeCodeBackgroundModelCommand =
    vscode.commands.registerCommand(
      'vscode-lm-proxy.selectClaudeCodeBackgroundModel',
      async () => {
        try {
          const backgroundModelId = await modelManager.selectModel(
            'claudeCodeBackground',
          )
          if (backgroundModelId) {
            context.globalState.update(
              'claudeCodeBackgroundModelId',
              backgroundModelId,
            )
            vscode.window.showInformationMessage(
              `Claude Code Background Model selected: ${backgroundModelId}`,
            )
          }
        } catch (error) {
          vscode.window.showErrorMessage(
            `Error selecting Claude Code Background model: ${(error as Error).message}`,
          )
        }
      },
    )

  // Claude Code Thinkingモデル選択コマンド
  const selectClaudeCodeThinkingModelCommand = vscode.commands.registerCommand(
    'vscode-lm-proxy.selectClaudeCodeThinkingModel',
    async () => {
      try {
        const thinkingModelId =
          await modelManager.selectModel('claudeCodeThinking')
        if (thinkingModelId) {
          context.globalState.update(
            'claudeCodeThinkingModelId',
            thinkingModelId,
          )
          vscode.window.showInformationMessage(
            `Claude Code Thinking Model selected: ${thinkingModelId}`,
          )
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error selecting Claude Code Thinking model: ${(error as Error).message}`,
        )
      }
    },
  )

  // Geminiモデル選択コマンド
  const selectGeminiModelCommand = vscode.commands.registerCommand(
    'vscode-lm-proxy.selectGeminiModel',
    async () => {
      try {
        // モデル選択ダイアログを表示
        const geminiModelId = await modelManager.selectModel('gemini')

        if (geminiModelId) {
          // モデルIDを設定
          context.globalState.update('geminiModelId', geminiModelId)
          vscode.window.showInformationMessage(
            `Gemini Model selected: ${geminiModelId}`,
          )
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error selecting Gemini model: ${(error as Error).message}`,
        )
      }
    },
  )

  // コンテキストにコマンドを登録
  context.subscriptions.push(
    selectOpenAIModelCommand,
    selectAnthropicModelCommand,
    selectClaudeCodeBackgroundModelCommand,
    selectClaudeCodeThinkingModelCommand,
    selectGeminiModelCommand,
  )

  // 前回選択されたOpenAIモデルを復元
  const previouslySelectedOpenAIModelId =
    context.globalState.get<string>('openaiModelId')
  if (previouslySelectedOpenAIModelId) {
    modelManager.setOpenAIModelId(previouslySelectedOpenAIModelId)
  }

  // 前回選択されたAnthropicモデルを復元
  const previouslySelectedAnthropicModelId =
    context.globalState.get<string>('anthropicModelId')
  if (previouslySelectedAnthropicModelId) {
    modelManager.setAnthropicModelId(previouslySelectedAnthropicModelId)
  }

  // 前回選択されたClaude Code Backgroundモデルを復元
  const previouslySelectedClaudeCodeBackgroundModelId =
    context.globalState.get<string>('claudeCodeBackgroundModelId')
  if (previouslySelectedClaudeCodeBackgroundModelId) {
    modelManager.setClaudeCodeBackgroundModelId(
      previouslySelectedClaudeCodeBackgroundModelId,
    )
  }

  // 前回選択されたClaude Code Thinkingモデルを復元
  const previouslySelectedClaudeCodeThinkingModelId =
    context.globalState.get<string>('claudeCodeThinkingModelId')
  if (previouslySelectedClaudeCodeThinkingModelId) {
    modelManager.setClaudeCodeThinkingModelId(
      previouslySelectedClaudeCodeThinkingModelId,
    )
  }

  // 前回選択されたGeminiモデルを復元
  const previouslySelectedGeminiModelId =
    context.globalState.get<string>('geminiModelId')
  if (previouslySelectedGeminiModelId) {
    modelManager.setGeminiModelId(previouslySelectedGeminiModelId)
  }

  // ステータスバーを更新
  statusBarManager.updateStatus(serverManager.isRunning())
}
