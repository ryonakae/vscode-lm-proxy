// OpenAI API形式とVSCode LM API形式の相互変換
import * as vscode from 'vscode';
import { OpenAIChatCompletionResponse, OpenAIChatCompletionChunk } from './types';

// モデルマネージャーをインポート
import { modelManager } from './manager';

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
            ? { 
                role: 'assistant',
                content: response.content || ''
              }
            : response.content === '' 
              ? { 
                  role: 'assistant'
                } 
              : { 
                  content: response.content
                },
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
        total_tokens: 0,
        prompt_tokens_details: {
          cached_tokens: 0,
          audio_tokens: 0
        },
        completion_tokens_details: {
          reasoning_tokens: 0,
          audio_tokens: 0,
          accepted_prediction_tokens: 0,
          rejected_prediction_tokens: 0
        }
      },
      service_tier: 'default'
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
    // systemロールの場合はUserメッセージとして扱う
    if (msg.role === 'system') {
      return vscode.LanguageModelChatMessage.User(`[SYSTEM] ${msg.content}`);
    }
    // user/assistantはそのまま使用
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
      total_tokens: 0,
      prompt_tokens_details: {
        cached_tokens: 0,
        audio_tokens: 0
      },
      completion_tokens_details: {
        reasoning_tokens: 0,
        audio_tokens: 0,
        accepted_prediction_tokens: 0,
        rejected_prediction_tokens: 0
      }
    },
    service_tier: 'default'
  } as OpenAIChatCompletionResponse;
}

/**
 * OpenAI Chat Completion APIリクエストのバリデーション
 * @param body リクエストボディ
 * @returns 検証済みのリクエストパラメータ
 */
export function validateAndConvertOpenAIRequest(body: any): {
  messages: any[];
  model: string;
  stream?: boolean;
} {
  // 必須フィールドのチェック
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    const error: any = new Error('The messages field is required');
    error.statusCode = 400;
    error.type = 'invalid_request_error';
    throw error;
  }
  
  // モデルの必須チェック
  if (!body.model) {
    const error: any = new Error('The model field is required');
    error.statusCode = 400;
    error.type = 'invalid_request_error';
    throw error;
  }
  
  const model = body.model;
  
  // モデルが'vscode-lm-proxy'の場合、選択中のOpenAIモデルがあるか確認
  if (model === 'vscode-lm-proxy' && !modelManager.getOpenaiModelId()) {
    const error: any = new Error('No valid OpenAI model selected. Please select a model first.');
    error.statusCode = 400;
    error.type = 'invalid_request_error';
    throw error;
  }
  
  // OpenAIリクエストをVSCodeリクエストに変換
  const { messages } = convertOpenAIRequestToVSCodeRequest(body);
  
  return {
    messages,
    model,
    stream: body.stream
  };
}
