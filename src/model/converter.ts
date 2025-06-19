// OpenAI API形式とVSCode LM API形式の相互変換
import * as vscode from 'vscode';
import { OpenAIChatCompletionResponse, OpenAIChatCompletionChunk } from './types';

/**
 * VSCode LM APIのレスポンスをOpenAI API形式に変換
 * @param response VSCode LM APIレスポンス
 * @param modelId モデルID
 * @param isStreaming ストリーミングモードかどうか
 * @returns OpenAI API形式のレスポンス
 */
export function convertToOpenAIFormat(
  response: { content: string; isComplete?: boolean },
  modelId: string,
  isStreaming: boolean = false
): OpenAIChatCompletionResponse | OpenAIChatCompletionChunk {
  const now = Math.floor(Date.now() / 1000);
  const randomId = `chatcmpl-${generateRandomId()}`;
  const systemFingerprint = `fp_${generateRandomId()}`;
  
  if (isStreaming) {
    // ストリーミング用のチャンクフォーマット
    return {
      id: randomId,
      object: 'chat.completion.chunk',
      created: now,
      model: modelId,
      system_fingerprint: systemFingerprint,
      choices: [
        {
          delta: response.isComplete || response.content === undefined
            ? { content: response.content || '' }
            : response.content === '' ? { role: 'assistant' } : { content: response.content },
          index: 0,
          finish_reason: response.isComplete ? 'stop' : null
        }
      ]
    } as OpenAIChatCompletionChunk;
  } else {
    // 通常のレスポンスフォーマット
    return {
      id: randomId,
      object: 'chat.completion',
      created: now,
      model: modelId,
      system_fingerprint: systemFingerprint,
      choices: [
        {
          message: {
            role: 'assistant',
            content: response.content || ''
          },
          index: 0,
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 0, // VSCode APIではトークン数が取得できないため0を返す
        completion_tokens: 0,
        total_tokens: 0
      }
    } as OpenAIChatCompletionResponse;
  }
}

/**
 * ランダムなIDを生成
 * @returns ランダム文字列
 */
function generateRandomId(): string {
  return Math.random().toString(36).substring(2, 12);
}

/**
 * OpenAI API形式のリクエストをVSCode LM API形式に変換
 * @param openaiRequest OpenAI形式のリクエスト
 * @returns VSCode LM API形式のリクエスト
 */
export function convertOpenAIRequestToVSCodeRequest(openaiRequest: any): {
  messages: vscode.LanguageModelChatMessage[]
} {
  // メッセージの変換
  const messages = openaiRequest.messages.map((msg: any) => {
    return new vscode.LanguageModelChatMessage(
      msg.role,
      msg.content
    );
  });
  
  return { messages };
}

/**
 * VSCode LM API形式のレスポンスをOpenAI API形式に変換
 * @param modelId モデルID
 * @param vsCodeResponse VSCode形式のレスポンス
 * @returns OpenAI API形式のレスポンス
 */
export function convertVSCodeResponseToOpenAIResponse(
  modelId: string,
  vsCodeResponse: any
): OpenAIChatCompletionResponse {
  const now = Math.floor(Date.now() / 1000);
  const randomId = `chatcmpl-${generateRandomId()}`;
  const systemFingerprint = `fp_${generateRandomId()}`;
  
  return {
    id: randomId,
    object: 'chat.completion',
    created: now,
    model: modelId,
    system_fingerprint: systemFingerprint,
    choices: [
      {
        message: {
          role: vsCodeResponse.message.role,
          content: vsCodeResponse.message.content
        },
        index: 0,
        finish_reason: 'stop'
      }
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    }
  } as OpenAIChatCompletionResponse;
}
