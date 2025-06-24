// OpenAI API形式とVSCode LM API形式の相互変換
import * as vscode from 'vscode';
import {
  OpenAIChatCompletionRequest,
  OpenAIChatCompletionResponse,
  OpenAIChatCompletionChunk,
  OpenAIChatMessage,
  OpenAIToolCall
} from './types';

// モデルマネージャーをインポート
import { modelManager } from './manager';

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
export function convertOpenaiRequestToVSCodeRequest(openaiRequest: OpenAIChatCompletionRequest): {
  messages: vscode.LanguageModelChatMessage[];
} {
  // OpenAIのroleをVSCodeのAPIに合わせて変換
  const messages = openaiRequest.messages.map((msg) => {
    if (msg.role === 'system') {
      // systemロールはUserメッセージとして扱う
      return vscode.LanguageModelChatMessage.User(`[SYSTEM] ${msg.content ?? ''}`, msg.name);
    }
    if (msg.role === 'user') {
      return vscode.LanguageModelChatMessage.User(msg.content, msg.name);
    }
    if (msg.role === 'assistant') {
      // tool_callsやnameも考慮
      return vscode.LanguageModelChatMessage.Assistant(
        msg.content,
        msg.name
      );
    }
    // その他はUserとして扱う
    return vscode.LanguageModelChatMessage.User(msg.content, msg.name);
  });
  return { messages };
}

/**
 * VSCode LM APIのレスポンスをOpenAI API形式に変換
 * @param response VSCode LM APIレスポンス
 * @param modelId モデルID
 * @param isStreaming ストリーミングモードかどうか
 * @returns OpenAI API形式のレスポンス
 */
export function convertVSCodeResponseToOpenaiResponse(
  response: { content: string | null; isComplete?: boolean; tool_calls?: OpenAIToolCall[]; name?: string },
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
          delta: {
            role: 'assistant',
            content: response.content ?? null,
            tool_calls: response.tool_calls,
            name: response.name
          },
          index: 0,
          finish_reason: response.isComplete ? 'stop' : null
        }
      ]
    } satisfies OpenAIChatCompletionChunk;
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
            content: response.content ?? null,
            tool_calls: response.tool_calls,
            name: response.name
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
    } satisfies OpenAIChatCompletionResponse;
  }
}

/**
 * OpenAI Chat Completion APIリクエストのバリデーション
 * @param body リクエストボディ
 * @returns 検証済みのリクエストパラメータ
 */
export function validateAndConvertOpenaiRequest(body: any): {
  messages: vscode.LanguageModelChatMessage[];
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
  
  let model = body.model;

  // モデルが'vscode-lm-proxy'の場合、選択中のOpenAIモデルがあるか確認し、modelを書き換える
  if (model === 'vscode-lm-proxy') {
    const openaiModelId = modelManager.getOpenaiModelId();
    if (!openaiModelId) {
      const error: any = new Error('No valid OpenAI model selected. Please select a model first.');
      error.statusCode = 400;
      error.type = 'invalid_request_error';
      throw error;
    }
    model = openaiModelId;
  }

  // OpenAIリクエストをVSCodeリクエストに変換
  const { messages } = convertOpenaiRequestToVSCodeRequest(body as OpenAIChatCompletionRequest);
  return {
    messages,
    model,
    stream: body.stream
  };
}
