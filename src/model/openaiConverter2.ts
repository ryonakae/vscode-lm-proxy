
import type { OpenAIChatCompletionRequest, Tool } from './types';
import { LanguageModelChatMessage, LanguageModelChatRequestOptions, LanguageModelChatTool, CancellationToken } from 'vscode';

/**
 * OpenAI APIリクエストをVSCode Language Model APIのsendRequest用引数に変換
 * @param openaiReq OpenAIChatCompletionRequest
 * @param token CancellationToken | undefined
 * @returns { messages, options, token }
 */
export function openaiToVSCodeChatArgs(
  openaiReq: OpenAIChatCompletionRequest,
  token?: CancellationToken
): {
  messages: LanguageModelChatMessage[];
  options: LanguageModelChatRequestOptions;
  token?: CancellationToken;
} {
  // Tool[] → LanguageModelChatTool[] 変換
  const tools: LanguageModelChatTool[] | undefined = openaiReq.tools?.map((tool: Tool) => ({
    name: tool.function.name,
    description: tool.function.description ?? '',
    inputSchema: tool.function.parameters ?? undefined,
  }));

  // OpenAI messages → LanguageModelChatMessage[]
  const messages: LanguageModelChatMessage[] = openaiReq.messages.map(m => {
    if (m.role === 'user') {
      return LanguageModelChatMessage.User
        ? LanguageModelChatMessage.User(m.content, m.name)
        : { role: 'user', content: m.content, name: m.name };
    } else if (m.role === 'assistant') {
      return LanguageModelChatMessage.Assistant
        ? LanguageModelChatMessage.Assistant(m.content, m.name)
        : { role: 'assistant', content: m.content, name: m.name };
    }
    // system/other role
    return { role: m.role, content: m.content, name: m.name };
  });

  // modelOptionsにOpenAIパラメータを詰める
  const modelOptions: Record<string, any> = {};
  if (openaiReq.temperature !== undefined) modelOptions.temperature = openaiReq.temperature;
  if (openaiReq.top_p !== undefined) modelOptions.top_p = openaiReq.top_p;
  if (openaiReq.max_tokens !== undefined) modelOptions.max_tokens = openaiReq.max_tokens;
  // 必要に応じて他のパラメータも追加

  const options = {
    modelOptions,
    tools,
    // 必要に応じてtoolModeやjustificationも追加
  };

  return { messages, options, token };
}
