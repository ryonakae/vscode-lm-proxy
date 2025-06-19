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
      function_call?: any;
      tool_calls?: any[];
      name?: string;
      context?: any;
      tool_call_id?: string;
      refusal?: null | {
        category: string;
        explanation: string;
      };
      annotations?: any[];
      logprobs?: any;
      model?: string;
    };
    index: number;
    finish_reason: string | null;
    logprobs?: any;
    logits?: any[];
    top_logprobs?: any[];
    tokens?: string[];
    text_offset?: number[];
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_tokens_details?: {
      cached_tokens: number;
      audio_tokens: number;
    };
    completion_tokens_details?: {
      reasoning_tokens: number;
      audio_tokens: number;
      accepted_prediction_tokens: number;
      rejected_prediction_tokens: number;
    };
  };
  system_fingerprint?: string;
  service_tier?: string;
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
      function_call?: any;
      tool_calls?: any[];
      name?: string;
      context?: any;
      tool_call_id?: string;
      refusal?: null | {
        category: string;
        explanation: string;
      };
      annotations?: any[];
      logprobs?: any;
      model?: string;
    };
    index: number;
    finish_reason: string | null;
    logprobs?: any;
    logits?: any[];
    top_logprobs?: any[];
    tokens?: string[];
    text_offset?: number[];
  }>;
  system_fingerprint?: string;
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
    function_call?: any;
    tool_calls?: any[];
    tool_call_id?: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: any[];
  tool_choice?: string | any;
  response_format?: any;
  seed?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}
