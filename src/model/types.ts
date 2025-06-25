// OpenAI APIとVSCode LM API関連の型定義

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAIChatMessage {
  role: string;
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  function_call?: any; // 非推奨
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
}

export interface OpenAIChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OpenAIChatMessage;
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
  metadata?: Record<string, any>;
}

export interface OpenAIChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    delta: Partial<OpenAIChatMessage>;
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

export interface Message {
  role: string;
  content: string;
  name?: string;
  function_call?: FunctionCall; // 非推奨
  tool_calls?: FunctionCall[];
  tool_call_id?: string;
}

export interface Prediction {
  type: 'content';
  content: string | { type: string; text: string }[];
}

export interface FunctionCall {
  name: string;
  arguments: string;
}

export interface Function {
  name: string;
  description?: string;
  parameters: Record<string, any>;
}

export type ToolChoice =
  | 'none'
  | 'auto'
  | {
      type: 'function';
      function: {
        name: string;
      };
    };

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: object;
    strict?: boolean | null;
  };
}

export type ResponseFormat =
  | { type: 'text' }
  | {
      type: 'json_schema';
      json_schema: {
        name: string;
        description?: string;
        schema?: object;
        strict?: boolean | null;
      };
    }
  | { type: 'json_object' };

export interface WebSearchOptions {
  search_context_size?: 'low' | 'medium' | 'high';
  user_location?: {
    type: 'approximate';
    approximate: {
      city?: string;
      country?: string;
      region?: string;
      timezone?: string;
    };
  } | null;
}

export interface OpenAIChatCompletionRequest {
  model: string;
  messages: Message[];
  audio?: {
    format: string;
    voice: string;
  } | null;
  frequency_penalty?: number | null;
  function_call?: 'none' | 'auto' | {
    name: string;
  }; // 非推奨
  functions?: Function[]; // 非推奨
  logit_bias?: Record<string, number> | null;
  logprobs?: boolean | null;
  max_completion_tokens?: number | null;
  max_tokens?: number | null; // 非推奨
  metadata?: Record<string, any>;
  modalities?: string[] | null;
  n?: number | null;
  parallel_tool_calls?: boolean;
  prediction?: Prediction;
  presence_penalty?: number | null;
  reasoning_effort?: 'low' | 'medium' | 'high' | null;
  response_format?: ResponseFormat;
  seed?: number | null;
  service_tier?: string | null;
  stop?: string | string[] | null;
  store?: boolean | null;
  stream?: boolean | null;
  stream_options?: {
    include_usage?: boolean;
  } | null;
  temperature?: number | null;
  tool_choice?: ToolChoice;
  tools?: Tool[];
  top_logprobs?: number | null;
  top_p?: number | null;
  user?: string;
  web_search_options?: WebSearchOptions;
}
