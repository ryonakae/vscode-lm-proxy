import {
  type CallableTool,
  type Content,
  type GenerateContentParameters,
  GoogleGenAI,
  type Part,
  type Tool,
} from '@google/genai'
import * as vscode from 'vscode'
import { logger } from '../utils/logger'

// sample
const ai = new GoogleGenAI({})
async function main() {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: 'Explain how AI works in a few words',
  })
  console.log(response.text)
}

/**
 * Gemini APIのGenerateContentリクエストを
 * VSCode拡張APIのチャットリクエスト形式に変換する。
 *
 * - contentsをVSCodeのメッセージ配列に変換
 * - tools, systemInstructionsなどをVSCode APIのオプション形式に変換
 * - VSCode APIが未対応のパラメータはmodelOptionsに集約
 * - 仕様差異を吸収するための変換ロジックを含む
 *
 * @param geminiRequest Geminiのリクエストパラメータ
 * @param vsCodeModel VSCodeのLanguageModelChatインスタンス
 * @returns VSCode拡張API用のチャットメッセージ配列とオプション
 */
export async function convertGeminiRequestToVSCodeRequest(
  geminiRequest: GenerateContentParameters,
  vsCodeModel: vscode.LanguageModelChat,
): Promise<{
  messages: vscode.LanguageModelChatMessage[]
  options: vscode.LanguageModelChatRequestOptions
  inputTokens: number
}> {
  logger.debug('Converting Gemini request to VSCode request')

  // --- messages変換 ---
  const messages: vscode.LanguageModelChatMessage[] = []

  // config.systemInstructionがあればassistant roleで先頭に追加
  if (geminiRequest.config?.systemInstruction) {
    const systemInstruction = geminiRequest.config.systemInstruction

    if (Array.isArray(systemInstruction)) {
      for (const instruction of systemInstruction) {
        if (typeof instruction === 'string') {
          messages.push(
            new vscode.LanguageModelChatMessage(
              vscode.LanguageModelChatMessageRole.Assistant,
              `[SYTESM] ${instruction}`,
              'System',
            ),
          )
        } else {
          messages.push(
            new vscode.LanguageModelChatMessage(
              vscode.LanguageModelChatMessageRole.Assistant,
              [convertPart(instruction)],
              'System',
            ),
          )
        }
      }
    } else if (isContent(systemInstruction)) {
      let content:
        | string
        | Array<
            | vscode.LanguageModelTextPart
            | vscode.LanguageModelToolCallPart
            | vscode.LanguageModelToolResultPart
          > = ''

      if (systemInstruction.parts && systemInstruction.parts.length > 0) {
        // partsを変換
        content = systemInstruction.parts.map(convertPart)
      }

      messages.push(
        new vscode.LanguageModelChatMessage(
          vscode.LanguageModelChatMessageRole.Assistant,
          content,
          'System',
        ),
      )
    } else if (isPart(systemInstruction)) {
      messages.push(
        new vscode.LanguageModelChatMessage(
          vscode.LanguageModelChatMessageRole.Assistant,
          [convertPart(systemInstruction)],
          'System',
        ),
      )
    }
  }

  // contentsを変換
  if (Array.isArray(geminiRequest.contents)) {
    // Content[] | PartUnion[] の場合
    messages.push(
      ...geminiRequest.contents.map(c => {
        let role: vscode.LanguageModelChatMessageRole =
          vscode.LanguageModelChatMessageRole.User
        let content:
          | string
          | Array<
              | vscode.LanguageModelTextPart
              | vscode.LanguageModelToolCallPart
              | vscode.LanguageModelToolResultPart
            > = ''
        let name = 'User'

        if (typeof c === 'string') {
          // stringの場合

          role = vscode.LanguageModelChatMessageRole.User
          name = 'User'

          // 内容をそのまま渡す
          content = c
        } else if (isContent(c)) {
          // Contentの場合

          // ロールを変換
          if (c.role === 'user') {
            role = vscode.LanguageModelChatMessageRole.User
            name = 'User'
          } else if (c.role === 'model') {
            role = vscode.LanguageModelChatMessageRole.Assistant
            name = 'Assistant'
          }

          // partsを変換
          if (c.parts && c.parts.length > 0) {
            content = c.parts.map(convertPart)
          }
        } else if (isPart(c)) {
          // Partの場合

          // ロールはUserとして扱う
          role = vscode.LanguageModelChatMessageRole.User
          name = 'User'

          // Partを変換
          content = [convertPart(c)]
        }

        return new vscode.LanguageModelChatMessage(role, content, name)
      }),
    )
  } else if (isContent(geminiRequest.contents)) {
    // Contentの場合
    let role: vscode.LanguageModelChatMessageRole =
      vscode.LanguageModelChatMessageRole.User
    let content:
      | string
      | Array<
          | vscode.LanguageModelTextPart
          | vscode.LanguageModelToolCallPart
          | vscode.LanguageModelToolResultPart
        > = ''
    let name = 'User'

    const c = geminiRequest.contents

    if (c.role === 'user') {
      // ロールを変換
      role = vscode.LanguageModelChatMessageRole.User
      name = 'User'
    } else if (c.role === 'model') {
      role = vscode.LanguageModelChatMessageRole.Assistant
      name = 'Assistant'
    }

    if (c.parts && c.parts.length > 0) {
      // partsを変換
      content = c.parts.map(convertPart)
    }

    messages.push(new vscode.LanguageModelChatMessage(role, content, name))
  } else if (isPart(geminiRequest.contents)) {
    // Partの場合
    const c = geminiRequest.contents

    // ロールはUserとして扱う
    const role = vscode.LanguageModelChatMessageRole.User
    const name = 'User'

    // Partを変換
    const content = [convertPart(c)]

    messages.push(new vscode.LanguageModelChatMessage(role, content, name))
  }

  // --- input tokens計算 ---
  let inputTokens = 0
  for (const msg of messages) {
    inputTokens += await vsCodeModel.countTokens(msg)
  }

  // --- options生成 ---
  const options: vscode.LanguageModelChatRequestOptions = {}

  // toolConfig変換
  if (geminiRequest.config?.toolConfig) {
    const toolConfig = geminiRequest.config.toolConfig

    if (toolConfig.functionCallingConfig) {
      const mode = toolConfig.functionCallingConfig.mode
      if (mode === 'AUTO') {
        options.toolMode = vscode.LanguageModelChatToolMode.Auto
      } else if (mode === 'ANY') {
        options.toolMode = vscode.LanguageModelChatToolMode.Required
      } else if (mode === 'NONE') {
        options.toolMode = vscode.LanguageModelChatToolMode.Auto
      }
    }
  }

  // tools変換
  if (geminiRequest.config?.tools && geminiRequest.config?.tools.length > 0) {
    options.tools = []

    for (const tool of geminiRequest.config.tools) {
      if (isTool(tool)) {
        // Toolの場合
        if (tool.functionDeclarations) {
          for (const func of tool.functionDeclarations) {
            options.tools.push({
              name: func.name || '',
              description: func.description || '',
              inputSchema: {
                parameters: func.parametersJsonSchema,
                response: func.responseJsonSchema,
              },
            })
          }
        }
      } else if (isCallableTool(tool)) {
        // CallableToolの場合
        const t = await tool.tool()
        if (t.functionDeclarations) {
          for (const func of t.functionDeclarations) {
            options.tools.push({
              name: func.name || '',
              description: func.description || '',
              inputSchema: {
                parameters: func.parametersJsonSchema,
                response: func.responseJsonSchema,
              },
            })
          }
        }
      }
    }
  }

  // --- その他パラメータはmodelOptionsに集約 ---
  const modelOptions: { [name: string]: any } = {}
  const modelOptionKeys = [
    'stopSequences',
    'responseMimeType',
    'responseSchema',
    'responseModalities',
    'candidateCount',
    'maxOutputTokens',
    'temperature',
    'topP',
    'topK',
    'seed',
    'presencePenalty',
    'frequencyPenalty',
    'responseLogprobs',
    'logprobs',
    'enableEnhancedCivicAnswers',
    'speechConfig',
    'thinkingConfig',
    'mediaResolution',
  ]
  for (const key of modelOptionKeys) {
    const config = geminiRequest.config
    if (config && key in config && (config as any)[key] !== undefined) {
      modelOptions[key] = (config as any)[key]
    }
  }

  // modelOptionsが空でなければoptionsに追加
  if (Object.keys(modelOptions).length > 0) {
    options.modelOptions = modelOptions
  }

  // --- 変換結果をログ出力 ---
  logger.debug('Converted Gemini request to VSCode request', {
    messages,
    options,
    inputTokens,
  })

  return {
    messages,
    options,
    inputTokens,
  }
}

/**
 * VSCodeのLanguageModelChatResponseをGemini形式に変換します。
 * ストリーミングの場合はGenerateContentResponseStreamのAsyncIterableを返し、
 * 非ストリーミングの場合は全文をGenerateContentResponse形式で返します。
 * @param vscodeResponse VSCodeのLanguageModelChatResponse
 * @param vsCodeModel VSCodeのLanguageModelChatインスタンス
 * @param isStreaming ストリーミングかどうか
 * @param inputTokens 入力トークン数
 * @returns Gemini Response または AsyncIterable
 */
export function convertVSCodeResponseToGeminiResponse(
  vscodeResponse: any,
  vsCodeModel: any,
  isStreaming: boolean,
  inputTokens: number,
): Promise<any> | AsyncIterable<any> {
  if (isStreaming) {
    return convertVSCodeStreamToGeminiStream(
      vscodeResponse.stream,
      vsCodeModel,
      inputTokens,
    )
  }

  // 非ストリーミング: VSCode text → Gemini Response
  return convertVSCodeTextToGeminiResponse(
    vscodeResponse,
    vsCodeModel,
    inputTokens,
  )
}

/**
 * VSCodeのストリームをGeminiのストリーム形式に変換する。
 * @param stream VSCodeのストリーム
 * @param vsCodeModel VSCodeのLanguageModelChatインスタンス
 * @param inputTokens 入力トークン数
 * @returns Gemini ストリームのAsyncIterable
 */
async function* convertVSCodeStreamToGeminiStream(
  stream: AsyncIterable<any>,
  vsCodeModel: any,
  inputTokens: number,
): AsyncIterable<any> {
  // TODO: 実装

  // ダミーのイテレーション
  for await (const part of stream) {
    yield {}
  }
}

/**
 * VSCodeのLanguageModelChatResponse（非ストリーミング）を
 * Geminiのレスポンス形式に変換する。
 * @param vscodeResponse VSCodeのLanguageModelChatResponse
 * @param vsCodeModel VSCodeのLanguageModelChatインスタンス
 * @param inputTokens 入力トークン数
 * @returns Gemini Response
 */
async function convertVSCodeTextToGeminiResponse(
  vscodeResponse: any,
  vsCodeModel: any,
  inputTokens: number,
): Promise<any> {
  // TODO: 実装

  // ダミーの返却値
  return {
    candidates: [],
    promptFeedback: {},
  }
}

/**
 * GeminiのPartをVSCodeのLanguageModel用パートに変換する
 * 仕様差異や拡張性を吸収するため、個別のif分岐で明示的に変換
 */
function convertPart(
  part: Part,
):
  | vscode.LanguageModelTextPart
  | vscode.LanguageModelToolCallPart
  | vscode.LanguageModelToolResultPart {
  if (typeof part === 'string') {
    return new vscode.LanguageModelTextPart(part)
  }
  if (part.inlineData) {
    return new vscode.LanguageModelTextPart(
      `[Inline Data] ${JSON.stringify(part.inlineData)}`,
    )
  }
  if (part.functionCall) {
    if (
      part.functionCall.id &&
      part.functionCall.name &&
      part.functionCall.args
    ) {
      return new vscode.LanguageModelToolCallPart(
        part.functionCall.id,
        part.functionCall.name,
        part.functionCall.args,
      )
    }
    return new vscode.LanguageModelTextPart(
      `[Function Call] ${JSON.stringify(part.functionCall)}`,
    )
  }
  if (part.functionResponse) {
    if (part.functionResponse.id && part.functionResponse.response) {
      return new vscode.LanguageModelToolResultPart(
        part.functionResponse.id,
        Object.entries(part.functionResponse.response).map(([key, value]) => {
          return new vscode.LanguageModelTextPart(
            `${key}: ${JSON.stringify(value)}`,
          )
        }),
      )
    }
    return new vscode.LanguageModelTextPart(
      `[Function Response] ${JSON.stringify(part.functionResponse)}`,
    )
  }
  if (part.fileData) {
    return new vscode.LanguageModelTextPart(
      `[File Data] ${JSON.stringify(part.fileData)}`,
    )
  }
  if (part.executableCode) {
    return new vscode.LanguageModelTextPart(
      `[Executable Code] ${part.executableCode}`,
    )
  }
  if (part.codeExecutionResult) {
    return new vscode.LanguageModelTextPart(
      `[Code Execution Result] ${JSON.stringify(part.codeExecutionResult)}`,
    )
  }
  if (part.text) {
    return new vscode.LanguageModelTextPart(part.text)
  }
  return new vscode.LanguageModelTextPart(
    `[Unknown Part] ${JSON.stringify(part)}`,
  )
}

/**
 * Content型かどうかを判定する型ガード
 */
export function isContent(obj: unknown): obj is Content {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    Array.isArray((obj as any).parts) &&
    // Content型はroleプロパティも持つ場合が多い
    ('role' in obj || (obj as any).parts.length >= 0)
  )
}

/**
 * Part型かどうかを判定する型ガード
 */
export function isPart(obj: unknown): obj is Part {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    // Part型はvideoMetadata, thought, inlineDataなどのプロパティを持つ可能性がある
    ('videoMetadata' in obj || 'thought' in obj || 'inlineData' in obj)
  )
}

/**
 * Content型 or Part型 or string型かどうかを判定する型ガード
 */
export function isContentOrPartOrString(
  obj: unknown,
): obj is Content | Part | string {
  return isContent(obj) || isPart(obj) || typeof obj === 'string'
}

function isCallableTool(obj: any): obj is CallableTool {
  return typeof obj?.tool === 'function' && typeof obj?.callTool === 'function'
}

function isTool(obj: any): obj is Tool {
  return (
    (typeof obj?.functionDeclarations !== 'undefined' ||
      typeof obj?.retrieval !== 'undefined' ||
      typeof obj?.googleSearch !== 'undefined') &&
    typeof obj?.tool !== 'function'
  )
}
