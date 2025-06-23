// Anthropic API形式とVSCode LM API形式の相互変換
import * as vscode from 'vscode';
import { AnthropicMessageResponse, AnthropicMessageChunk, AnthropicModel, AnthropicModelsResponse } from './types';

/**
 * VSCode LM APIのレスポンスをAnthropic API形式に変換
 * @param response VSCode LM APIレスポンス
 * @param modelId モデルID
 * @param isStreaming ストリーミングモードかどうか
 * @returns Anthropic API形式のレスポンス
 */
export function convertToAnthropicFormat(
  response: { content: string; isComplete?: boolean },
  modelId: string,
  isStreaming: boolean = false
): AnthropicMessageResponse | AnthropicMessageChunk {
  const now = Math.floor(Date.now() / 1000);
  const randomId = `msg_${generateRandomId()}`;

  if (isStreaming) {
    // ストリーミング用のチャンクフォーマット
    return {
      id: randomId,
      type: 'message',
      role: 'assistant',
      content: response.isComplete || response.content === undefined
        ? [{ type: 'text', text: response.content || '' }]
        : [{ type: 'text', text: response.content }],
      model: modelId,
      stop_reason: response.isComplete ? 'end_turn' : null,
      stop_sequence: null,
      usage: {
        input_tokens: 0,  // VSCode APIではトークン数が取得できないため0を返す
        output_tokens: 0
      },
      container: null
    } as AnthropicMessageChunk;
  } else {
    // 通常のレスポンスフォーマット
    return {
      id: randomId,
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: response.content || '' }],
      model: modelId,
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 0,  // VSCode APIではトークン数が取得できないため0を返す
        output_tokens: 0
      },
      container: null
    } as AnthropicMessageResponse;
  }
}

/**
 * ランダムなIDを生成
 * @returns ランダム文字列
 */
function generateRandomId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Anthropic API形式のリクエストをVSCode LM API形式に変換
 * @param anthropicRequest Anthropic形式のリクエスト
 * @returns VSCode LM API形式のリクエスト
 */
export function convertAnthropicRequestToVSCodeRequest(anthropicRequest: any): {
  messages: vscode.LanguageModelChatMessage[];
  systemPrompt?: string;
} {
  // システムプロンプトの取得
  let systemPrompt: string | undefined = undefined;
  if (anthropicRequest.system) {
    if (typeof anthropicRequest.system === 'string') {
      systemPrompt = anthropicRequest.system;
    } else if (Array.isArray(anthropicRequest.system)) {
      // 配列形式のシステムプロンプトを文字列に変換
      systemPrompt = anthropicRequest.system
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');
    }
  }
  
  // メッセージの変換
  const messages = anthropicRequest.messages.map((msg: any) => {
    // contentが配列の場合は、textのみを抽出
    let content = msg.content;
    if (Array.isArray(content)) {
      content = content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');
    }
    
    return new vscode.LanguageModelChatMessage(
      msg.role,
      content
    );
  });
  
  return { messages, systemPrompt };
}

/**
 * 利用可能なモデル情報をAnthropic API形式で返す
 * @returns Anthropic API形式のモデル一覧レスポンス
 */
export function getAnthropicModels(): AnthropicModelsResponse {
  // Anthropic互換のモデル一覧を作成
  const models: AnthropicModel[] = [
    {
      id: 'claude-3-7-sonnet-20250219',
      type: 'model',
      display_name: 'Claude 3.7 Sonnet',
      created_at: '2025-02-19T00:00:00Z'
    },
    {
      id: 'claude-3-5-sonnet-20240620',
      type: 'model',
      display_name: 'Claude 3.5 Sonnet',
      created_at: '2024-06-20T00:00:00Z'
    }
  ];
  
  return {
    data: models,
    first_id: models[0].id,
    last_id: models[models.length - 1].id,
    has_more: false
  };
}

/**
 * 特定のモデルIDに対応するAnthropic API形式のモデル情報を返す
 * @param modelId モデルID
 * @returns Anthropic API形式のモデル情報
 */
export function getAnthropicModelInfo(modelId: string): AnthropicModel | null {
  // モデルIDに対応するモデル情報を返す
  const models = getAnthropicModels().data;
  return models.find(model => model.id === modelId) || null;
}
