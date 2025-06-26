import type { APIPromise } from '@anthropic-ai/sdk'
import type { Stream } from '@anthropic-ai/sdk/core/streaming'
import type {
  Message,
  MessageCreateParams,
  RawMessageStreamEvent,
} from '@anthropic-ai/sdk/resources'
import * as vscode from 'vscode'
import { logger } from '../utils/logger'

/**
 * Anthropic APIのChatCompletionCreateParamsリクエストをVSCode拡張APIのチャットリクエスト形式に変換します。
 * Anthropicのmessages, tools, tool_choice等をVSCodeの型にマッピングし、
 * VSCode APIがサポートしないパラメータはmodelOptionsに集約して将来の拡張性を確保します。
 * Anthropic独自のroleやtool指定など、API間の仕様差異を吸収するための変換ロジックを含みます。
 * @param {MessageCreateParams} anthropicRequest Anthropicのチャットリクエストパラメータ
 * @returns {{ messages: vscode.LanguageModelChatMessage[], options: vscode.LanguageModelChatRequestOptions }}
 *   VSCode拡張API用のチャットメッセージ配列とオプション
 */
export function convertAnthropicRequestToVSCodeRequest(
  anthropicRequest: MessageCreateParams,
): {
  messages: vscode.LanguageModelChatMessage[]
  options: vscode.LanguageModelChatRequestOptions
} {
  logger.info(
    'Converting Anthropic request to VSCode request',
    anthropicRequest,
  )

  // messages変換
  const messages: vscode.LanguageModelChatMessage[] = (
    anthropicRequest.messages || []
  ).map((msg: any) => {
    let role: vscode.LanguageModelChatMessageRole
    let content = ''
    let prefix = ''
    switch (msg.role) {
      case 'user':
        role = vscode.LanguageModelChatMessageRole.User
        break
      case 'assistant':
        role = vscode.LanguageModelChatMessageRole.Assistant
        break
      default:
        // user/assistant以外はUser扱い、prefixで区別
        role = vscode.LanguageModelChatMessageRole.User
        prefix = `[${msg.role?.toUpperCase()}] `
    }
    if (typeof msg.content === 'string') {
      content = prefix + msg.content
    } else if (Array.isArray(msg.content)) {
      // textのみ連結
      content =
        prefix +
        msg.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('\n')
    }
    return new vscode.LanguageModelChatMessage(role, content)
  })

  // options生成
  const options: vscode.LanguageModelChatRequestOptions = {}

  // tools
  if ('tools' in anthropicRequest && Array.isArray(anthropicRequest.tools)) {
    options.tools = anthropicRequest.tools.map((tool: any) => {
      const base = {
        name: tool.name,
        description: tool.description ?? '',
      }
      return tool.input_schema !== undefined
        ? { ...base, inputSchema: tool.input_schema }
        : base
    })
  }

  // tool_choice
  if (
    'tool_choice' in anthropicRequest &&
    anthropicRequest.tool_choice !== undefined
  ) {
    const tc = anthropicRequest.tool_choice
    if (typeof tc === 'object' && tc.type === 'auto') {
      options.toolMode = vscode.LanguageModelChatToolMode.Auto
    } else if (typeof tc === 'object' && tc.type === 'none') {
      options.toolMode = vscode.LanguageModelChatToolMode.Auto // VSCode APIにNoneはないためAuto
    } else if (typeof tc === 'object' && tc.type === 'any') {
      options.toolMode = vscode.LanguageModelChatToolMode.Auto
    } else if (typeof tc === 'object' && tc.type === 'tool') {
      options.toolMode = vscode.LanguageModelChatToolMode.Required
    }
  }

  // その他パラメータはmodelOptionsに集約
  const modelOptionKeys = [
    'max_tokens',
    'temperature',
    'top_p',
    'stop_sequences',
    'system',
    'metadata',
    'stream',
    'tools',
    'tool_choice',
    'model',
    'service_tier',
    'container',
    'mcp_servers',
    'thinking',
  ]
  const modelOptions: { [name: string]: any } = {}
  for (const key of modelOptionKeys) {
    if (
      key in anthropicRequest &&
      (anthropicRequest as any)[key] !== undefined
    ) {
      modelOptions[key] = (anthropicRequest as any)[key]
    }
  }
  if (Object.keys(modelOptions).length > 0) {
    options.modelOptions = modelOptions
  }

  // ログ表示
  logger.info('Converted Anthropic request to VSCode request', {
    messages,
    options,
  })

  return { messages, options }
}

// export function convertVSCodeResponseToAnthropicResponse(
//   vscodeResponse: vscode.LanguageModelChatResponse,
//   model: string,
//   isStreaming: boolean,
// ): APIPromise<Message> | APIPromise<Stream<RawMessageStreamEvent>> {}
