import type {
  ContentBlock,
  Message,
  MessageCreateParams,
  RawMessageStreamEvent,
  StopReason,
  Tool,
  WebSearchTool20250305,
} from '@anthropic-ai/sdk/resources'
import * as vscode from 'vscode'
import { isTextPart, isToolCallPart } from '../server/handler'
import { generateRandomId } from '../utils'
import { logger } from '../utils/logger'

/**
 * Anthropic APIのMessageCreateParamsリクエストを
 * VSCode拡張APIのチャットリクエスト形式に変換する。
 *
 * - systemプロンプトやmessagesをVSCodeのメッセージ配列に変換
 * - tools, tool_choice等をVSCode APIのオプション形式に変換
 * - VSCode APIが未対応のパラメータはmodelOptionsに集約
 * - 仕様差異を吸収するための変換ロジックを含む
 *
 * @param anthropicRequest Anthropicのチャットリクエストパラメータ
 * @param vsCodeModel VSCodeのLanguageModelChatインスタンス
 * @returns VSCode拡張API用のチャットメッセージ配列とオプション
 */
export function convertAnthropicRequestToVSCodeRequest(
  anthropicRequest: MessageCreateParams,
  _vsCodeModel: vscode.LanguageModelChat,
): {
  messages: vscode.LanguageModelChatMessage[]
  options: vscode.LanguageModelChatRequestOptions
} {
  logger.info('Converting Anthropic request to VSCode request')

  // --- messages変換 ---
  const messages: vscode.LanguageModelChatMessage[] = []

  // systemプロンプトがあればassistant roleで先頭に追加
  if ('system' in anthropicRequest && anthropicRequest.system) {
    if (typeof anthropicRequest.system === 'string') {
      // stringの場合
      messages.push(
        new vscode.LanguageModelChatMessage(
          vscode.LanguageModelChatMessageRole.Assistant,
          `[SYSTEM] ${anthropicRequest.system}`,
          'System',
        ),
      )
    } else if (Array.isArray(anthropicRequest.system)) {
      // TextBlockParam[] の場合
      for (const block of anthropicRequest.system) {
        if (block.type === 'text' && typeof block.text === 'string') {
          messages.push(
            new vscode.LanguageModelChatMessage(
              vscode.LanguageModelChatMessageRole.Assistant,
              `[SYSTEM] ${block.text}`,
              'System',
            ),
          )
        }
      }
    }
  }

  // 通常のmessagesを追加
  messages.push(
    ...anthropicRequest.messages.map(msg => {
      let role: vscode.LanguageModelChatMessageRole
      let content:
        | string
        | Array<
            | vscode.LanguageModelTextPart
            | vscode.LanguageModelToolResultPart
            | vscode.LanguageModelToolCallPart
          > = ''
      let name = 'Assistant'

      // ロール変換
      switch (msg.role) {
        case 'user':
          role = vscode.LanguageModelChatMessageRole.User
          name = 'User'
          break
        case 'assistant':
          role = vscode.LanguageModelChatMessageRole.Assistant
          name = 'Assistant'
          break
      }

      // content変換（string or array）
      if (typeof msg.content === 'string') {
        content = msg.content
      } else if (Array.isArray(msg.content)) {
        content = msg.content.map(c => {
          switch (c.type) {
            case 'text':
              return new vscode.LanguageModelTextPart(c.text)
            case 'image':
              return new vscode.LanguageModelTextPart(
                `[Image] ${JSON.stringify(c)}`,
              )
            case 'tool_use':
              return new vscode.LanguageModelToolCallPart(
                c.id,
                c.name,
                c.input ?? {},
              )
            case 'tool_result':
              // c.contentが配列の場合
              if (Array.isArray(c.content)) {
                return new vscode.LanguageModelToolResultPart(
                  c.tool_use_id,
                  c.content.map(c => {
                    switch (c.type) {
                      case 'text':
                        return new vscode.LanguageModelTextPart(c.text)
                      case 'image':
                        return new vscode.LanguageModelTextPart(
                          `[image] ${JSON.stringify(c)}`,
                        )
                    }
                  }),
                )
              }

              // c.contentがstringの場合
              return new vscode.LanguageModelToolResultPart(c.tool_use_id, [
                c.content ?? 'undefined',
              ])
            case 'document':
              return new vscode.LanguageModelTextPart(
                `[Document] ${JSON.stringify(c)}`,
              )
            case 'thinking':
              return new vscode.LanguageModelTextPart(
                `[Thinking] ${JSON.stringify(c)}`,
              )
            case 'redacted_thinking':
              return new vscode.LanguageModelTextPart(
                `[Redacted Thinking] ${JSON.stringify(c)}`,
              )
            case 'server_tool_use':
              return new vscode.LanguageModelTextPart('[Server Tool Use]')
            case 'web_search_tool_result':
              return new vscode.LanguageModelTextPart(
                '[Web Search Tool Result]',
              )
            default:
              return new vscode.LanguageModelTextPart(
                `[Unknown Type] ${JSON.stringify(c)}`,
              )
          }
        })
      }

      return new vscode.LanguageModelChatMessage(role, content, name)
    }),
  )

  // --- options生成 ---
  const options: vscode.LanguageModelChatRequestOptions = {}

  // tool_choice変換
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

  // tools変換
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

  // --- その他パラメータはmodelOptionsに集約 ---
  const modelOptions: { [name: string]: any } = {}
  const modelOptionKeys = [
    'max_tokens',
    'container',
    'mcp_servers',
    'metadata',
    'service_tier',
    'stop_sequences',
    'stream',
    'temperature',
    'thinking',
    'top_k',
    'top_p',
  ]

  // --- その他のオプションをmodelOptionsに追加 ---
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

  // --- 変換結果をログ出力 ---
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
  modelId: string,
  isStreaming: boolean,
): Promise<Message> | AsyncIterable<RawMessageStreamEvent> {
  if (isStreaming) {
    // ストリーミング: VSCode stream → Anthropic RawMessageStreamEvent列に変換
    return convertVSCodeStreamToAnthropicStream(vscodeResponse.stream, modelId)
  }

  // 非ストリーミング: VSCode text → Anthropic Message
  return convertVSCodeTextToAnthropicMessage(vscodeResponse, modelId)
}

/**
 * VSCodeのストリームをAnthropicのRawMessageStreamEvent列に変換する。
 * - テキストパートはcontent_block_start, content_block_delta, content_block_stopで表現
 * - ツールコールパートはtool_useブロックとして表現
 * - 最後にmessage_delta, message_stopを送信
 * @param stream VSCodeのストリーム
 * @param modelId モデルID
 * @returns Anthropic RawMessageStreamEventのAsyncIterable
 */
async function* convertVSCodeStreamToAnthropicStream(
  stream: AsyncIterable<
    vscode.LanguageModelTextPart | vscode.LanguageModelToolCallPart | unknown
  >,
  modelId: string,
): AsyncIterable<RawMessageStreamEvent> {
  const messageId = `msg_${generateRandomId()}`
  let stopReason: StopReason = 'end_turn'

  // --- message_startイベント送信 ---
  yield {
    type: 'message_start',
    message: {
      id: messageId,
      type: 'message',
      role: 'assistant',
      content: [],
      model: modelId,
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        server_tool_use: null,
        service_tier: null,
      },
    },
  }

  let contentIndex = 0
  let isInsideTextBlock = false

  // --- ストリームを順次処理 ---
  for await (const part of stream) {
    if (isTextPart(part)) {
      // テキストブロック開始
      if (!isInsideTextBlock) {
        yield {
          type: 'content_block_start',
          index: contentIndex,
          content_block: { type: 'text', text: '', citations: [] },
        }
        isInsideTextBlock = true
      }
      // テキスト差分を送信
      yield {
        type: 'content_block_delta',
        index: contentIndex,
        delta: { type: 'text_delta', text: part.value },
      }
    } else if (isToolCallPart(part)) {
      // テキストブロック終了
      if (isInsideTextBlock) {
        yield { type: 'content_block_stop', index: contentIndex }
        isInsideTextBlock = false
        contentIndex++
      }
      // ツールコール時はstopReasonを変更
      stopReason = 'tool_use'

      // ツールコールブロック開始
      yield {
        type: 'content_block_start',
        index: contentIndex,
        content_block: {
          type: 'tool_use',
          id: part.callId,
          name: part.name,
          input: {},
        },
      }

      // input_json_deltaを送信
      yield {
        type: 'content_block_delta',
        index: contentIndex,
        delta: {
          type: 'input_json_delta',
          partial_json: JSON.stringify(part.input ?? {}),
        },
      }

      // ツールコールブロック終了
      yield { type: 'content_block_stop', index: contentIndex }
      contentIndex++
    }
  }

  // --- 最後のテキストブロックが未終了なら閉じる ---
  if (isInsideTextBlock) {
    yield { type: 'content_block_stop', index: contentIndex }
    contentIndex++
  }

  // --- message_deltaイベント送信 ---
  yield {
    type: 'message_delta',
    delta: {
      stop_reason: stopReason,
      stop_sequence: null,
    },
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      server_tool_use: null,
    },
  }

  // --- message_stopイベント送信 ---
  yield { type: 'message_stop' }
}

/**
 * VSCodeのLanguageModelChatResponse（非ストリーミング）を
 * AnthropicのMessage形式に変換する。
 * - テキストパートはtextブロックとして連結
 * - ツールコールパートはtool_useブロックとして追加
 * @param vscodeResponse VSCodeのLanguageModelChatResponse
 * @param modelId モデルID
 * @returns Anthropic Message
 */
async function convertVSCodeTextToAnthropicMessage(
  vscodeResponse: vscode.LanguageModelChatResponse,
  modelId: string,
): Promise<Message> {
  const id = `msg_${generateRandomId()}`

  const content: ContentBlock[] = []
  let textBuffer = ''
  let isToolCalled = false

  // --- ストリームを順次処理 ---
  for await (const part of vscodeResponse.stream) {
    if (isTextPart(part)) {
      // テキストはバッファに連結
      textBuffer += part.value
    } else if (isToolCallPart(part)) {
      // tool_useブロック追加
      content.push({
        type: 'tool_use',
        id: part.callId,
        name: part.name,
        input: part.input,
      })
      isToolCalled = true
    }
  }

  // 残りのテキストバッファをtextブロックとして追加
  if (textBuffer) {
    content.push({ type: 'text', text: textBuffer, citations: [] })
  }

  // contentが空なら空textブロックを追加
  if (content.length === 0) {
    content.push({ type: 'text', text: '', citations: [] })
  }

  // --- Anthropic Messageオブジェクトを返す ---
  return {
    id,
    type: 'message',
    role: 'assistant',
    content,
    model: modelId,
    stop_reason: isToolCalled ? 'tool_use' : 'end_turn',
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
