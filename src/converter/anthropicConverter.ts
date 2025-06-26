import type { APIPromise } from '@anthropic-ai/sdk'
import type { Stream } from '@anthropic-ai/sdk/core/streaming'
import type {
  Message,
  MessageCreateParams,
  RawMessageStreamEvent,
  Tool,
  ToolBash20250124,
  ToolTextEditor20250124,
  ToolUnion,
  WebSearchTool20250305,
} from '@anthropic-ai/sdk/resources'
import type { ComputerTool } from 'openai/resources/responses/responses.js'
import * as vscode from 'vscode'
import { isTextPart, isToolCallPart } from '../server/handlers'
import { generateRandomId } from '../utils'
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
  const messages: vscode.LanguageModelChatMessage[] =
    anthropicRequest.messages.map(msg => {
      let role: vscode.LanguageModelChatMessageRole
      let content = ''
      switch (msg.role) {
        case 'user':
          role = vscode.LanguageModelChatMessageRole.User
          break
        case 'assistant':
          role = vscode.LanguageModelChatMessageRole.Assistant
          break
      }
      if (typeof msg.content === 'string') {
        content = msg.content
      } else if (Array.isArray(msg.content)) {
        // textのみ連結
        content = msg.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n')
      }
      return new vscode.LanguageModelChatMessage(role, content)
    })

  // options生成
  const options: vscode.LanguageModelChatRequestOptions = {}

  // tool_choice
  if (
    'tool_choice' in anthropicRequest &&
    anthropicRequest.tool_choice !== undefined
  ) {
    const tc = anthropicRequest.tool_choice
    switch (tc.type) {
      case 'auto':
        options.toolMode = vscode.LanguageModelChatToolMode.Auto
        break
      case 'any':
        options.toolMode = vscode.LanguageModelChatToolMode.Auto
        break
      case 'tool':
        options.toolMode = vscode.LanguageModelChatToolMode.Required
        break
      case 'none': // VSCode APIにNoneはないためAuto
        options.toolMode = vscode.LanguageModelChatToolMode.Auto
        break
    }
  }

  // tools
  if ('tools' in anthropicRequest && Array.isArray(anthropicRequest.tools)) {
    options.tools = anthropicRequest.tools.map(tool => {
      switch (tool.name) {
        // bash
        case 'bash':
          return {
            name: tool.name,
            description: `Bash shell execution. type: ${tool.type}`,
            inputSchema: undefined,
          }
        // code execution
        case 'code_execution':
          return {
            name: tool.name,
            description: `Code execution. type: ${tool.type}`,
            inputSchema: undefined,
          }
        // computer use
        case 'computer': {
          const computerTool = tool as any

          return {
            name: computerTool.name,
            description: `Computer use tool. type: ${tool.type}`,
            inputSchema: {
              display_height_px: computerTool.display_height_px,
              display_width_px: computerTool.display_width_px,
              display_number: computerTool.display_number,
            },
          }
        }
        // text editor (str_replace_editor)
        case 'str_replace_editor': {
          return {
            name: tool.name,
            description: `Text editor tool. type: ${tool.type}`,
          }
        }
        // text editor (str_replace_based_edit_tool)
        case 'str_replace_based_edit_tool': {
          return {
            name: tool.name,
            description: `Text editor tool. type: ${tool.type}`,
          }
        }
        // web search
        case 'web_search': {
          const webSearchTool = tool as WebSearchTool20250305

          return {
            name: tool.name,
            description: `Web search tool. type: ${tool.type}`,
            inputSchema: {
              allowed_domains: webSearchTool.allowed_domains,
              blocked_domains: webSearchTool.blocked_domains,
              max_uses: webSearchTool.max_uses,
              user_location: webSearchTool.user_location,
            },
          }
        }
        // custom tool
        default: {
          const customTool = tool as Tool

          return {
            name: customTool.name,
            description: customTool.description ?? '',
            inputSchema: customTool.input_schema,
          }
        }
      }
    })
  }

  // その他パラメータはmodelOptionsに集約
  const modelOptionKeys = [
    'max_tokens',
    'container',
    'mcp_servers',
    'metadata',
    'service_tier',
    'stop_sequences',
    'stream',
    'system',
    'temperature',
    'thinking',
    'top_k',
    'top_p',
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

/**
 * VSCodeのLanguageModelChatResponseをAnthropicのMessageまたはAsyncIterable<RawMessageStreamEvent>形式に変換します。
 * ストリーミングの場合はRawMessageStreamEventのAsyncIterableを返し、
 * 非ストリーミングの場合は全文をMessage形式で返します。
 * @param vscodeResponse VSCodeのLanguageModelChatResponse
 * @param modelId モデルID
 * @param isStreaming ストリーミングかどうか
 * @returns Message または AsyncIterable<RawMessageStreamEvent>
 */
export function convertVSCodeResponseToAnthropicResponse(
  vscodeResponse: vscode.LanguageModelChatResponse,
  model: string,
  isStreaming: boolean,
): Promise<Message> | AsyncIterable<RawMessageStreamEvent> {
  if (isStreaming) {
    // ストリーミング: VSCode stream → Anthropic RawMessageStreamEvent列に変換
    return convertVSCodeStreamToAnthropicStream(vscodeResponse.stream, model)
  }

  // 非ストリーミング: VSCode text → Anthropic Message
  return convertVSCodeTextToAnthropicMessage(vscodeResponse, model)
}

// VSCode stream → Anthropic RawMessageStreamEvent[] 変換
async function* convertVSCodeStreamToAnthropicStream(
  stream: AsyncIterable<
    vscode.LanguageModelTextPart | vscode.LanguageModelToolCallPart | unknown
  >,
  model: string,
): AsyncIterable<RawMessageStreamEvent> {}

// VSCode text → Anthropic Message 変換
async function convertVSCodeTextToAnthropicMessage(
  vscodeResponse: vscode.LanguageModelChatResponse,
  model: string,
): Promise<Message> {
  const id = `msg_${generateRandomId()}`

  // content
  let content = ''
  for await (const part of vscodeResponse.stream) {
    if (isTextPart(part)) {
      content += part.value
    }
  }

  return {
    id,
    type: 'message',
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: content,
        citations: [],
      },
    ],
    model,
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      input_tokens: 0,
      output_tokens: 0,
      server_tool_use: null,
      service_tier: null,
    },
    // container: null
  }
}
