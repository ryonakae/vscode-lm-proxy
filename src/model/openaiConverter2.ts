import * as vscode from 'vscode';
import { ChatCompletionCreateParams } from 'openai/resources/chat/completions';

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
export function convertOpenaiRequestToVSCodeRequest2(openaiRequest: ChatCompletionCreateParams): {
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