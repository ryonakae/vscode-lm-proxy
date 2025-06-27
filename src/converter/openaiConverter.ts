import type OpenAI from 'openai'
import * as vscode from 'vscode'
import { isTextPart, isToolCallPart } from '../server/handlers'
import { generateRandomId } from '../utils'
import { logger } from '../utils/logger'

/**
 * OpenAI APIのChatCompletionCreateParamsリクエストをVSCode拡張APIのチャットリクエスト形式に変換します。
 * OpenAIのmessages, tools, tool_choice等をVSCodeの型にマッピングし、
 * VSCode APIがサポートしないパラメータはmodelOptionsに集約して将来の拡張性を確保します。
 * OpenAI独自のroleやtool指定など、API間の仕様差異を吸収するための変換ロジックを含みます。
 * @param {OpenAI.ChatCompletionCreateParams} openaiRequest OpenAIのチャットリクエストパラメータ
 * @returns {{ messages: vscode.LanguageModelChatMessage[], options: vscode.LanguageModelChatRequestOptions }}
 *   VSCode拡張API用のチャットメッセージ配列とオプション
 */
export function convertOpenAIRequestToVSCodeRequest(
  openaiRequest: OpenAI.ChatCompletionCreateParams,
): {
  messages: vscode.LanguageModelChatMessage[]
  options: vscode.LanguageModelChatRequestOptions
} {
  logger.info('Converting OpenAI request to VSCode request', openaiRequest)

  // OpenAIのmessagesをVSCodeのLanguageModelChatMessage[]に変換
  const messages: vscode.LanguageModelChatMessage[] =
    openaiRequest.messages.map(msg => {
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
          // user/assistant以外はAssistant扱い、prefixで区別
          role = vscode.LanguageModelChatMessageRole.Assistant
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

      let name: string | undefined
      if ('name' in msg) {
        name = msg.name
      }

      return new vscode.LanguageModelChatMessage(role, content, name)
    })

  // options生成
  const options: vscode.LanguageModelChatRequestOptions = {}

  // tool_choice: OpenAIのtool_choiceをVSCodeのtoolModeに変換
  if (
    'tool_choice' in openaiRequest &&
    openaiRequest.tool_choice !== undefined
  ) {
    // OpenAI: 'none'|'auto'|'required'|{type:'function', function:{name}}
    // VSCode: LanguageModelChatToolMode.None|Auto|Required
    const tc = openaiRequest.tool_choice
    if (typeof tc === 'string') {
      switch (tc) {
        case 'none':
          // VSCode APIにOff/Noneは存在しないためAutoにフォールバック
          options.toolMode = vscode.LanguageModelChatToolMode.Auto
          break
        case 'auto':
          options.toolMode = vscode.LanguageModelChatToolMode.Auto
          break
        case 'required':
          options.toolMode = vscode.LanguageModelChatToolMode.Required
          break
        // それ以外は無視
      }
    }
    // function.name指定は現状サポート外
  }

  // tools: OpenAIのtools配列をVSCodeのLanguageModelChatTool[]に変換
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
  for (const key of modelOptionKeys) {
    if (key in openaiRequest && (openaiRequest as any)[key] !== undefined) {
      modelOptions[key] = (openaiRequest as any)[key]
    }
  }
  if (Object.keys(modelOptions).length > 0) {
    options.modelOptions = modelOptions
  }

  // ログ表示
  logger.info('Converted OpenAI request to VSCode request', {
    messages,
    options,
  })

  return { messages, options }
}

/**
 * VSCodeのLanguageModelChatResponseをOpenAIのChatCompletionまたはChatCompletionChunk形式に変換します。
 * ストリーミングの場合はChatCompletionChunkのAsyncIterableを返し、
 * 非ストリーミングの場合は全文をChatCompletion形式で返します。
 * @param vscodeResponse VSCodeのLanguageModelChatResponse
 * @param modelId モデルID
 * @param isStreaming ストリーミングかどうか
 * @returns ChatCompletion または AsyncIterable<ChatCompletionChunk>
 */
export function convertVSCodeResponseToOpenAIResponse(
  vscodeResponse: vscode.LanguageModelChatResponse,
  modelId: string,
  isStreaming: boolean,
): Promise<OpenAI.ChatCompletion> | AsyncIterable<OpenAI.ChatCompletionChunk> {
  if (isStreaming) {
    // ストリーミング: ChatCompletionChunkのAsyncIterableを返す
    return convertVSCodeStreamToOpenAIChunks(vscodeResponse.stream, modelId)
  }
  // 非ストリーミング: 全文をOpenAI ChatCompletionに変換
  return convertVSCodeTextToOpenAICompletion(vscodeResponse, modelId)
}

// VSCode ToolCall → OpenAI tool_call 変換 (stream)
function convertVSCodeToolCallToOpenAIChunkToolCall(
  part: vscode.LanguageModelToolCallPart,
  index: number,
): OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall {
  return {
    index,
    id: part.callId,
    type: 'function',
    function: {
      name: part.name,
      arguments: JSON.stringify(part.input),
    },
  }
}

// VSCode ToolCall → OpenAI tool_call 変換 (non-stream)
function convertVSCodeToolCallToOpenAIToolCall(
  part: vscode.LanguageModelToolCallPart,
): OpenAI.Chat.Completions.ChatCompletionMessageToolCall {
  return {
    id: part.callId,
    type: 'function',
    function: {
      name: part.name,
      arguments: JSON.stringify(part.input),
    },
  }
}

// ストリーミング: VSCode stream → OpenAI ChatCompletionChunk[]
async function* convertVSCodeStreamToOpenAIChunks(
  stream: AsyncIterable<
    vscode.LanguageModelTextPart | vscode.LanguageModelToolCallPart | unknown
  >,
  model: string,
): AsyncIterable<OpenAI.ChatCompletionChunk> {
  const randomId = `chatcmpl-${generateRandomId()}`
  const created = Math.floor(Date.now() / 1000)

  let isRoleSent = false
  let toolCallIndex = 0
  let isToolCalled = false // tool_callが出現したかどうか

  // ストリーミングチャンクを生成
  for await (const part of stream) {
    const chunk: OpenAI.ChatCompletionChunk = {
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: null,
        },
      ],
      created,
      id: randomId,
      model,
      object: 'chat.completion.chunk',
      // service_tier: undefined,
      // system_fingerprint: undefined,
      // usage: {
      //   completion_tokens: 0,
      //   prompt_tokens: 0,
      //   total_tokens: 0,
      //   completion_tokens_details: {
      //     accepted_prediction_tokens: 0,
      //     audio_tokens: 0,
      //     reasoning_tokens: 0,
      //     rejected_prediction_tokens: 0,
      //   },
      //   prompt_tokens_details: {
      //     audio_tokens: 0,
      //     cached_tokens: 0,
      //   },
      // },
    }

    if (isTextPart(part)) {
      if (!isRoleSent) {
        chunk.choices[0].delta.role = 'assistant'
        isRoleSent = true
      }
      chunk.choices[0].delta.content = part.value
    } else if (isToolCallPart(part)) {
      chunk.choices[0].delta.tool_calls = [
        convertVSCodeToolCallToOpenAIChunkToolCall(part, toolCallIndex++),
      ]
      isToolCalled = true
    } else {
      // unknownパートは無視
      continue
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
    model,
    object: 'chat.completion.chunk',
    // service_tier: undefined,
    // system_fingerprint: undefined,
    // usage: {
    //   completion_tokens: 0,
    //   prompt_tokens: 0,
    //   total_tokens: 0,
    //   completion_tokens_details: {
    //     accepted_prediction_tokens: 0,
    //     audio_tokens: 0,
    //     reasoning_tokens: 0,
    //     rejected_prediction_tokens: 0,
    //   },
    //   prompt_tokens_details: {
    //     audio_tokens: 0,
    //     cached_tokens: 0,
    //   },
    // },
  }
}

// 非ストリーミング: VSCode text → OpenAI ChatCompletion
async function convertVSCodeTextToOpenAICompletion(
  vscodeResponse: vscode.LanguageModelChatResponse,
  model: string,
): Promise<OpenAI.ChatCompletion> {
  const id = `chatcmpl-${generateRandomId()}`
  const created = Math.floor(Date.now() / 1000)

  // content & toolCalls
  let content = ''
  const toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = []
  for await (const part of vscodeResponse.stream) {
    if (isTextPart(part)) {
      content += part.value
    } else if (isToolCallPart(part)) {
      toolCalls.push(convertVSCodeToolCallToOpenAIToolCall(part))
    }
  }

  // choice
  const choice: OpenAI.Chat.Completions.ChatCompletion.Choice = {
    index: 0,
    message: {
      role: 'assistant',
      content,
      refusal: null,
    },
    logprobs: null,
    finish_reason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
  }
  if (toolCalls.length > 0) {
    choice.message.tool_calls = toolCalls
  }

  return {
    choices: [choice],
    created,
    id,
    model,
    object: 'chat.completion',
    // service_tier: undefined,
    // system_fingerprint: undefined,
    // usage: {
    //   completion_tokens: 0,
    //   prompt_tokens: 0,
    //   total_tokens: 0,
    //   completion_tokens_details: {
    //     accepted_prediction_tokens: 0,
    //     audio_tokens: 0,
    //     reasoning_tokens: 0,
    //     rejected_prediction_tokens: 0,
    //   },
    //   prompt_tokens_details: {
    //     audio_tokens: 0,
    //     cached_tokens: 0,
    //   },
    // },
  }
}
