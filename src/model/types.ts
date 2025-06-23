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
 * Anthropic Message APIのレスポンス型
 */
export interface AnthropicMessageResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  container: any | null;
}

/**
 * Anthropic Message Stream APIのチャンク型
 */
export interface AnthropicMessageChunk {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  container: any | null;
}

/**
 * Anthropic Modelの型定義
 */
export interface AnthropicModel {
  id: string;
  type: 'model';
  display_name: string;
  created_at: string;
  capabilities?: {
    tools?: boolean;
    functions?: boolean;
    tool_conversation?: boolean;
    vision?: boolean;
  };
  context_window?: number;
  max_tokens?: number;
}

/**
 * Anthropic Models APIのレスポンス型
 */
export interface AnthropicModelsResponse {
  data: AnthropicModel[];
  first_id: string | null;
  last_id: string | null;
  has_more: boolean;
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

/**
 * Claude Code向けのツール呼び出し型定義
 */
export interface ClaudeCodeTool {
  type: string;
  name: string;
  description?: string;
  parameters?: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Claude Code向けのツール呼び出し結果型定義
 */
export interface ClaudeCodeToolCall {
  id: string;
  type: string;
  name: string;
  input: Record<string, any>;
}

/**
 * Claude Code向けのツール呼び出し結果型定義
 */
export interface ClaudeCodeToolResult {
  tool_call_id: string;
  output: string | Record<string, any>;
  error?: string;
}

/**
 * Claude Code API特有の追加型定義
 */
export interface ClaudeCodeSpecificFields {
  tools?: ClaudeCodeTool[];
  tool_choice?: 'auto' | 'none' | { type: string; name: string };
  tool_calls?: ClaudeCodeToolCall[];
  tool_results?: ClaudeCodeToolResult[];
}
