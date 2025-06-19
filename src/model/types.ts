// OpenAI APIとVSCode LM API関連の型定義

/**
 * OpenAI Chat Completion APIのレスポンス型
 */
export interface OpenAIChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    index: number;
    finish_reason: string | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI Chat Completion Stream APIのチャンク型
 */
export interface OpenAIChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    delta: {
      role?: string;
      content?: string;
    };
    index: number;
    finish_reason: string | null;
  }>;
}

/**
 * OpenAI Chat Completion APIのリクエスト型
 */
export interface OpenAIChatCompletionRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string;
    name?: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}
