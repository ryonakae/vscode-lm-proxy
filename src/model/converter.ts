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
  response: vscode.LanguageModelChatCompletionItem | vscode.LanguageModelChatCompletionItem,
  modelId: string,
  isStreaming: boolean = false
): OpenAIChatCompletionResponse | OpenAIChatCompletionChunk {
  const now = Math.floor(Date.now() / 1000);
  
  if (isStreaming) {
    // ストリーミング用のチャンクフォーマット
    return {
      id: `chatcmpl-${generateRandomId()}`,
      object: 'chat.completion.chunk',
      created: now,
      model: modelId,
      choices: [
        {
          delta: {
            role: 'assistant',
            content: response.content || ''
          },
          index: 0,
          finish_reason: response.isComplete ? 'stop' : null
        }
      ]
    } as OpenAIChatCompletionChunk;
  } else {
    // 通常のレスポンスフォーマット
    return {
      id: `chatcmpl-${generateRandomId()}`,
      object: 'chat.completion',
      created: now,
      model: modelId,
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
