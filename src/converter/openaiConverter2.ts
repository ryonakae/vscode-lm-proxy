import * as vscode from 'vscode';
import OpenAI from 'openai';
import { generateRandomId } from '../utils';

/**
 * OpenAI APIのChatCompletionCreateParamsリクエストをVSCode拡張APIのチャットリクエスト形式に変換する。
 *
 * OpenAIのmessages, tools, tool_choice等をVSCodeの型にマッピングし、
 * VSCode APIがサポートしないパラメータはmodelOptionsに集約して将来の拡張性を確保する。
 * OpenAI独自のroleやtool指定など、API間の仕様差異を吸収するための変換ロジックを含む。
 *
 * @param {ChatCompletionCreateParams} openaiRequest - OpenAIのチャットリクエストパラメータ
 * @returns {{ messages: vscode.LanguageModelChatMessage[], options: vscode.LanguageModelChatRequestOptions }}
 *   VSCode拡張API用のチャットメッセージ配列とオプション
 */
export function convertOpenAIRequestToVSCodeRequest2(openaiRequest: OpenAI.ChatCompletionCreateParams): {
  messages: vscode.LanguageModelChatMessage[],
  options: vscode.LanguageModelChatRequestOptions
} {
  // OpenAIのmessagesをVSCodeのLanguageModelChatMessage[]に変換
  const messages: vscode.LanguageModelChatMessage[] = (openaiRequest.messages || []).map((msg: any) => {
    let role: vscode.LanguageModelChatMessageRole;
    let content: string = '';
    let prefix = '';
    switch (msg.role) {
      case 'user':
        role = vscode.LanguageModelChatMessageRole.User;
        break;
      case 'assistant':
        role = vscode.LanguageModelChatMessageRole.Assistant;
        break;
      default:
        // user/assistant以外はAssistant扱い、prefixで区別
        role = vscode.LanguageModelChatMessageRole.Assistant;
        prefix = `[${msg.role?.toUpperCase()}] `;
    }
    if (typeof msg.content === 'string') {
      content = prefix + msg.content;
    } else if (Array.isArray(msg.content)) {
      // textのみ連結
      content = prefix + msg.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n');
    }
    let name: string | undefined = undefined;
    if (msg.role === 'tool' || msg.role === 'function') {
      name = msg.name;
    }
    return new vscode.LanguageModelChatMessage(role, content, name);
  });

  // options生成
  const options: vscode.LanguageModelChatRequestOptions = {};
  // tools, tool_choiceはAPI仕様に従いマッピング
  // tools: OpenAIのtools配列をVSCodeのLanguageModelChatTool[]に変換
  if ('tools' in openaiRequest && Array.isArray(openaiRequest.tools)) {
    options.tools = openaiRequest.tools.map((tool) => {
      const base = {
        name: tool.function.name,
        description: tool.function.description ?? ''
      };
      return tool.function.parameters !== undefined
        ? { ...base, inputSchema: tool.function.parameters }
        : base;
    });
  }
  // tool_choice: OpenAIのtool_choiceをVSCodeのtoolModeに変換
  if ('tool_choice' in openaiRequest && openaiRequest.tool_choice !== undefined) {
    // OpenAI: 'none'|'auto'|'required'|{type:'function', function:{name}}
    // VSCode: LanguageModelChatToolMode.None|Auto|Required
    const tc = openaiRequest.tool_choice;
    if (typeof tc === 'string') {
      switch (tc) {
        case 'none':
          // VSCode APIにOff/Noneは存在しないためAutoにフォールバック
          options.toolMode = vscode.LanguageModelChatToolMode.Auto;
          break;
        case 'auto':
          options.toolMode = vscode.LanguageModelChatToolMode.Auto;
          break;
        case 'required':
          options.toolMode = vscode.LanguageModelChatToolMode.Required;
          break;
        // それ以外は無視
      }
    }
    // function.name指定は現状サポート外
  }
  // その他のパラメータはmodelOptionsにまとめて渡す
  const modelOptions: { [name: string]: any } = {};
  const modelOptionKeys = [
    'max_tokens', 'temperature', 'top_p', 'stop', 'presence_penalty', 'frequency_penalty', 'seed', 'logit_bias', 'user', 'n', 'stream', 'response_format', 'function_call', 'functions', 'tools', 'tool_choice'
  ];
  for (const key of modelOptionKeys) {
    if (key in openaiRequest && (openaiRequest as any)[key] !== undefined) {
      modelOptions[key] = (openaiRequest as any)[key];
    }
  }
  if (Object.keys(modelOptions).length > 0) {
    options.modelOptions = modelOptions;
  }

  return { messages, options };
}

// VSCodeのLanguageModelTextPart/LanguageModelToolCallPart型ガード
function isTextPart(part: any): part is vscode.LanguageModelTextPart {
  return part instanceof vscode.LanguageModelTextPart;
}
function isToolCallPart(part: any): part is vscode.LanguageModelToolCallPart {
  return part instanceof vscode.LanguageModelToolCallPart;
}

// VSCode ToolCall → OpenAI tool_call 変換
function convertToolCall(part: vscode.LanguageModelToolCallPart, index: number): OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall {
  return {
    index,
    id: part.callId,
    type: 'function',
    function: {
      name: part.name,
      arguments: JSON.stringify(part.input),
    },
  };
}

// ストリーミング: VSCode stream → OpenAI ChatCompletionChunk[]
async function* convertVSCodeStreamToOpenAIChunks(
  stream: AsyncIterable<vscode.LanguageModelTextPart | vscode.LanguageModelToolCallPart | unknown>,
  model: string
): AsyncIterable<OpenAI.ChatCompletionChunk> {
  const randomId = `chatcmpl-${generateRandomId()}`;
  const created = Math.floor(Date.now() / 1000);
  let roleSent = false;
  let toolCallIndex = 0;
  for await (const part of stream) {
    const chunk: OpenAI.ChatCompletionChunk = {
      id: randomId,
      created,
      model,
      object: 'chat.completion.chunk',
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: null,
        },
      ],
    };
    if (isTextPart(part)) {
      if (!roleSent) {
        chunk.choices[0].delta.role = 'assistant';
        roleSent = true;
      }
      chunk.choices[0].delta.content = part.value;
    } else if (isToolCallPart(part)) {
      chunk.choices[0].delta.tool_calls = [convertToolCall(part, toolCallIndex++)];
    } else {
      // unknownパートは無視
      continue;
    }
    yield chunk;
  }
  // 終了チャンク
  yield {
    id: randomId,
    created,
    model,
    object: 'chat.completion.chunk',
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: 'stop',
      },
    ],
  };
}

// 非ストリーミング: VSCode text → OpenAI ChatCompletion
async function convertVSCodeTextToOpenAICompletion(
  vscodeResponse: vscode.LanguageModelChatResponse,
  model: string
): Promise<OpenAI.ChatCompletion> {
  const randomId = `chatcmpl-${generateRandomId()}`;
  const created = Math.floor(Date.now() / 1000);
  let content = '';
  let toolCalls: any[] = [];
  if (vscodeResponse && typeof vscodeResponse.text === 'object' && Symbol.asyncIterator in vscodeResponse.text) {
    for await (const part of vscodeResponse.text) {
      content += part;
    }
  }
  if (vscodeResponse && typeof vscodeResponse.stream === 'object' && Symbol.asyncIterator in vscodeResponse.stream) {
    for await (const part of vscodeResponse.stream) {
      if (isToolCallPart(part)) {
        toolCalls.push(convertToolCall(part, 0));
      }
    }
  }
  const choice: any = {
    index: 0,
    message: {
      role: 'assistant',
      content,
    },
    finish_reason: 'stop',
  };
  if (toolCalls.length > 0) {
    choice.message.tool_calls = toolCalls;
  }
  return {
    id: randomId,
    created,
    model,
    object: 'chat.completion',
    choices: [choice],
  };
}

/**
 * VSCode LanguageModelChatResponseをOpenAI ChatCompletion/ChatCompletionChunk形式に変換
 * @param vscodeResponse VSCodeのLanguageModelChatResponse
 * @param opts 追加情報（model名など）
 * @returns ChatCompletion または AsyncIterable<ChatCompletionChunk>
 */
export function convertVSCodeResponseToOpenAIResponse2(
  vscodeResponse: vscode.LanguageModelChatResponse,
  model: string
): Promise<OpenAI.ChatCompletion> | AsyncIterable<OpenAI.ChatCompletionChunk> {
  if (vscodeResponse && typeof vscodeResponse.stream === 'object' && Symbol.asyncIterator in vscodeResponse.stream) {
    // ストリーミング: ChatCompletionChunkのAsyncIterableを返す
    return convertVSCodeStreamToOpenAIChunks(vscodeResponse.stream, model);
  } else {
    // 非ストリーミング: 全文をOpenAI ChatCompletionに変換
    return convertVSCodeTextToOpenAICompletion(vscodeResponse, model);
  }
}

