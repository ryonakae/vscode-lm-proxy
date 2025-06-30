import type {
  Chat,
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
} from 'openai/resources'
import * as vscode from 'vscode'
import { isTextPart, isToolCallPart } from '../server/handler'
import { generateRandomId } from '../utils'
import { logger } from '../utils/logger'

/**
 * OpenAI APIのChatCompletionCreateParamsリクエストをVSCode拡張APIのチャットリクエスト形式に変換します。
 * OpenAIのmessages, tools, tool_choice等をVSCodeの型にマッピングし、
 * VSCode APIがサポートしないパラメータはmodelOptionsに集約して将来の拡張性を確保します。
 * OpenAI独自のroleやtool指定など、API間の仕様差異を吸収するための変換ロジックを含みます。
 * @param {ChatCompletionCreateParams} openaiRequest OpenAIのチャットリクエストパラメータ
 * @param {vscode.LanguageModelChat} vsCodeModel VSCodeのLanguageModelChatインスタンス
 * @returns {{ messages: vscode.LanguageModelChatMessage[], options: vscode.LanguageModelChatRequestOptions }}
 *   VSCode拡張API用のチャットメッセージ配列とオプション
 */
export async function convertOpenAIRequestToVSCodeRequest(
  openaiRequest: ChatCompletionCreateParams,
  vsCodeModel: vscode.LanguageModelChat,
): Promise<{
  messages: vscode.LanguageModelChatMessage[]
  options: vscode.LanguageModelChatRequestOptions
  inputTokens: number
}> {
  logger.info('Converting OpenAI request to VSCode request')

  // OpenAIのmessagesをVSCodeのLanguageModelChatMessage[]に変換
  const messages: vscode.LanguageModelChatMessage[] =
    openaiRequest.messages.map(msg => {
      let role: vscode.LanguageModelChatMessageRole
      let content:
        | string
        | Array<
            | vscode.LanguageModelTextPart
            | vscode.LanguageModelToolResultPart
            | vscode.LanguageModelToolCallPart
          > = ''
      let prefix = ''
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
        case 'developer':
          role = vscode.LanguageModelChatMessageRole.Assistant
          prefix = '[DEVELOPER] '
          name = 'Developer'
          break
        case 'system':
          role = vscode.LanguageModelChatMessageRole.Assistant
          prefix = '[SYSTEM] '
          name = 'System'
          break
        case 'tool':
          role = vscode.LanguageModelChatMessageRole.Assistant
          prefix = '[TOOL] '
          name = 'Tool'
          break
        case 'function':
          role = vscode.LanguageModelChatMessageRole.Assistant
          prefix = '[FUNCTION] '
          name = 'Function'
          break
      }

      // contentの変換（string or array）
      if (typeof msg.content === 'string') {
        content = prefix + msg.content
      } else if (Array.isArray(msg.content)) {
        content = msg.content.map(c => {
          switch (c.type) {
            case 'text':
              return new vscode.LanguageModelTextPart(c.text)
            case 'image_url':
              return new vscode.LanguageModelTextPart(
                `[Image URL]: ${JSON.stringify(c.image_url)}`,
              )
            case 'input_audio':
              return new vscode.LanguageModelTextPart(
                `[Input Audio]: ${JSON.stringify(c.input_audio)}`,
              )
            case 'file':
              return new vscode.LanguageModelTextPart(
                `[File]: ${JSON.stringify(c.file)}`,
              )
            case 'refusal':
              return new vscode.LanguageModelTextPart(`[Refusal]: ${c.refusal}`)
          }
        })
      }

      return new vscode.LanguageModelChatMessage(role, content, name)
    })

  // --- input tokens計算 ---
  let inputTokens = 0
  for (const msg of messages) {
    inputTokens += await vsCodeModel.countTokens(msg)
  }

  // --- options生成 ---
  const options: vscode.LanguageModelChatRequestOptions = {}

  // tool_choice変換
  if (
    'tool_choice' in openaiRequest &&
    openaiRequest.tool_choice !== undefined
  ) {
    const tc = openaiRequest.tool_choice
    if (typeof tc === 'string') {
      // 'auto' | 'required' | 'none' の場合
      switch (tc) {
        case 'auto':
          options.toolMode = vscode.LanguageModelChatToolMode.Auto
          break
        case 'required':
          options.toolMode = vscode.LanguageModelChatToolMode.Required
          break
        case 'none':
          // VSCode APIにOff/Noneは存在しないためAutoにフォールバック
          options.toolMode = vscode.LanguageModelChatToolMode.Auto
          break
      }
    } else {
      // 'function' の場合
      options.toolMode = vscode.LanguageModelChatToolMode.Auto
    }
  }

  // tools変換
  if ('tools' in openaiRequest && Array.isArray(openaiRequest.tools)) {
    options.tools = openaiRequest.tools.map(tool => {
      const base = {
        name: tool.function.name,
        description: tool.function.description ?? '',
      }
      return tool.function.parameters !== undefined
        ? { ...base, inputSchema: tool.function.parameters }
        : base
    })
  }

  // その他のパラメータはmodelOptionsにまとめて渡す
  const modelOptions: { [name: string]: any } = {}
  const modelOptionKeys = [
    'audio',
    'frequency_penalty',
    'function_call',
    'functions',
    'logit_bias',
    'logprobs',
    'max_completion_tokens',
    'max_tokens',
    'metadata',
    'modalities',
    'n',
    'parallel_tool_calls',
    'prediction',
    'presence_penalty',
    'reasoning_effort',
    'response_format',
    'seed',
    'service_tier',
    'stop',
    'store',
    'stream',
    'stream_options',
    'temperature',
    'top_logprobs',
    'top_p',
    'user',
    'web_search_options',
  ]

  // --- その他のオプションをmodelOptionsに追加 ---
  for (const key of modelOptionKeys) {
    if (key in openaiRequest && (openaiRequest as any)[key] !== undefined) {
      modelOptions[key] = (openaiRequest as any)[key]
    }
  }
  if (Object.keys(modelOptions).length > 0) {
    options.modelOptions = modelOptions
  }

  // --- 変換結果をログ出力 ---
  logger.info('Converted OpenAI request to VSCode request', {
    messages,
    options,
    inputTokens,
  })

  return { messages, options, inputTokens }
}

/**
 * VSCodeのLanguageModelChatResponseをOpenAIのChatCompletionまたはChatCompletionChunk形式に変換します。
 * ストリーミングの場合はChatCompletionChunkのAsyncIterableを返し、
 * 非ストリーミングの場合は全文をChatCompletion形式で返します。
 * @param vscodeResponse VSCodeのLanguageModelChatResponse
 * @param vsCodeModel VSCodeのLanguageModelChatインスタンス
 * @param isStreaming ストリーミングかどうか
 * @param inputTokens 入力トークン数
 * @returns ChatCompletion または AsyncIterable<ChatCompletionChunk>
 */
export function convertVSCodeResponseToOpenAIResponse(
  vscodeResponse: vscode.LanguageModelChatResponse,
  vsCodeModel: vscode.LanguageModelChat,
  isStreaming: boolean,
  inputTokens: number,
): Promise<ChatCompletion> | AsyncIterable<ChatCompletionChunk> {
  // ストリーミングの場合
  if (isStreaming) {
    // ChatCompletionChunkのAsyncIterableを返す
    return convertVSCodeStreamToOpenAIChunks(
      vscodeResponse.stream,
      vsCodeModel,
      inputTokens,
    )
  }
  // 非ストリーミングの場合
  // 全文をOpenAI ChatCompletionに変換
  return convertVSCodeTextToOpenAICompletion(
    vscodeResponse,
    vsCodeModel,
    inputTokens,
  )
}

/**
 * VSCodeのストリームをOpenAIのChatCompletionChunkのAsyncIterableに変換します。
 * @param stream VSCodeのストリーム
 * @param vsCodeModel VSCodeのLanguageModelChatインスタンス
 * @param inputTokens 入力トークン数
 * @returns AsyncIterable<ChatCompletionChunk>
 */
async function* convertVSCodeStreamToOpenAIChunks(
  stream: AsyncIterable<
    vscode.LanguageModelTextPart | vscode.LanguageModelToolCallPart | unknown
  >,
  vsCodeModel: vscode.LanguageModelChat,
  inputTokens: number,
): AsyncIterable<ChatCompletionChunk> {
  // チャンクIDとタイムスタンプ生成
  const randomId = `chatcmpl-${generateRandomId()}`
  const created = Math.floor(Date.now() / 1000)

  let isRoleSent = false
  let toolCallIndex = 0
  let isToolCalled = false // tool_callが出現したかどうか

  let outputTokens = 0 // 出力トークン数

  // ストリーミングチャンクを生成
  for await (const part of stream) {
    // チャンクの初期化
    const chunk: ChatCompletionChunk = {
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: null,
        },
      ],
      created,
      id: randomId,
      model: vsCodeModel.id,
      object: 'chat.completion.chunk',
      service_tier: undefined,
      system_fingerprint: undefined,
      usage: {
        completion_tokens: 0,
        prompt_tokens: 0,
        total_tokens: 0,
        completion_tokens_details: {
          accepted_prediction_tokens: 0,
          audio_tokens: 0,
          reasoning_tokens: 0,
          rejected_prediction_tokens: 0,
        },
        prompt_tokens_details: {
          audio_tokens: 0,
          cached_tokens: 0,
        },
      },
    }

    // テキストパートの場合
    if (isTextPart(part)) {
      if (!isRoleSent) {
        chunk.choices[0].delta.role = 'assistant'
        isRoleSent = true
      }
      chunk.choices[0].delta.content = part.value

      // 出力トークン数を加算
      outputTokens += await vsCodeModel.countTokens(part.value)
    }
    // ツールコールパートの場合
    else if (isToolCallPart(part)) {
      chunk.choices[0].delta.tool_calls = [
        {
          index: toolCallIndex++,
          id: part.callId,
          type: 'function',
          function: {
            name: part.name,
            arguments: JSON.stringify(part.input),
          },
        },
      ]

      // ツールコールもトークン数に加算
      outputTokens += await vsCodeModel.countTokens(JSON.stringify(part))

      isToolCalled = true
    }

    yield chunk
  }

  // 終了チャンクを生成
  yield {
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: isToolCalled ? 'tool_calls' : 'stop',
      },
    ],
    created,
    id: randomId,
    model: vsCodeModel.id,
    object: 'chat.completion.chunk',
    service_tier: undefined,
    system_fingerprint: undefined,
    usage: {
      completion_tokens: outputTokens,
      prompt_tokens: inputTokens,
      total_tokens: inputTokens + outputTokens,
      // completion_tokens_details: {
      //   accepted_prediction_tokens: 0,
      //   audio_tokens: 0,
      //   reasoning_tokens: 0,
      //   rejected_prediction_tokens: 0,
      // },
      // prompt_tokens_details: {
      //   audio_tokens: 0,
      //   cached_tokens: 0,
      // },
    },
  }
}

/**
 * 非ストリーミング: VSCodeのLanguageModelChatResponseをOpenAIのChatCompletion形式に変換します。
 * @param vscodeResponse VSCodeのLanguageModelChatResponse
 * @param vsCodeModel VSCodeのLanguageModelChatインスタンス
 * @param inputTokens 入力トークン数
 * @returns Promise<ChatCompletion>
 */
async function convertVSCodeTextToOpenAICompletion(
  vscodeResponse: vscode.LanguageModelChatResponse,
  vsCodeModel: vscode.LanguageModelChat,
  inputTokens: number,
): Promise<ChatCompletion> {
  // チャットIDとタイムスタンプ生成
  const id = `chatcmpl-${generateRandomId()}`
  const created = Math.floor(Date.now() / 1000)

  // contentとtoolCallsの初期化
  let textBuffer = ''
  const toolCalls: Chat.Completions.ChatCompletionMessageToolCall[] = []
  let isToolCalled = false

  let outputTokens = 0 // 出力トークン数

  // ストリームからパートを順次取得
  for await (const part of vscodeResponse.stream) {
    if (isTextPart(part)) {
      // テキストはバッファに連結
      textBuffer += part.value

      // 出力トークン数を加算
      outputTokens += await vsCodeModel.countTokens(part.value)
    } else if (isToolCallPart(part)) {
      // ツールはtoolCallsに追加
      toolCalls.push({
        id: part.callId,
        type: 'function',
        function: {
          name: part.name,
          arguments: JSON.stringify(part.input),
        },
      })

      // ツールコールもトークン数に加算
      outputTokens += await vsCodeModel.countTokens(JSON.stringify(part))

      isToolCalled = true
    }
  }

  // choiceオブジェクトの生成
  const choice: Chat.Completions.ChatCompletion.Choice = {
    index: 0,
    message: {
      role: 'assistant',
      content: textBuffer,
      refusal: null,
      tool_calls: isToolCalled ? toolCalls : undefined,
    },
    logprobs: null,
    finish_reason: isToolCalled ? 'tool_calls' : 'stop',
  }

  // ChatCompletionオブジェクトを返却
  return {
    choices: [choice],
    created,
    id,
    model: vsCodeModel.id,
    object: 'chat.completion',
    service_tier: undefined,
    system_fingerprint: undefined,
    usage: {
      completion_tokens: outputTokens,
      prompt_tokens: inputTokens,
      total_tokens: inputTokens + outputTokens,
      // completion_tokens_details: {
      //   accepted_prediction_tokens: 0,
      //   audio_tokens: 0,
      //   reasoning_tokens: 0,
      //   rejected_prediction_tokens: 0,
      // },
      // prompt_tokens_details: {
      //   audio_tokens: 0,
      //   cached_tokens: 0,
      // },
    },
  }
}
