// Anthropic API形式とVSCode LM API形式の相互変換
import * as vscode from 'vscode';
import { AnthropicMessageResponse, AnthropicMessageChunk, AnthropicModel, AnthropicModelsResponse } from './types';

// モデルマネージャーをインポート
import { modelManager } from './manager';

/**
 * VSCode LM APIのレスポンスをAnthropic API形式に変換
 * @param response VSCode LM APIレスポンス
 * @param modelId モデルID
 * @param isStreaming ストリーミングモードかどうか
 * @param toolCalls ツール呼び出し情報（オプション）
 * @returns Anthropic API形式のレスポンス
 */
export function convertToAnthropicFormat(
  response: { content: string; isComplete?: boolean },
  modelId: string,
  isStreaming: boolean = false,
  toolCalls?: any[]
): AnthropicMessageResponse | AnthropicMessageChunk {
  const now = Math.floor(Date.now() / 1000);
  const randomId = `msg_${generateRandomId()}`;
  
  // Claude Codeツール呼び出しを検出して処理
  let toolCallsDetected = undefined;
  let responseContent = response.content || '';

  // レスポンステキストからツール呼び出しを検出する
  // (テキストから解析する必要があるため簡略化していますが、実際にはより堅牢な解析が必要)
  if (!toolCalls && responseContent.includes('```json') && (responseContent.includes('"type":') || responseContent.includes('"name":'))) {
    try {
      // JSONブロックを抽出
      const jsonMatch = responseContent.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch && jsonMatch[1]) {
        const jsonStr = jsonMatch[1].trim();
        const toolCall = JSON.parse(jsonStr);
        
        if (toolCall && toolCall.name) {
          // ツール呼び出しとして検出された場合
          toolCallsDetected = [{
            id: `call_${generateRandomId()}`,
            type: toolCall.type || 'function',
            name: toolCall.name,
            input: toolCall.input || {}
          }];
          
          // レスポンスからJSON部分を削除
          responseContent = responseContent.replace(/```json\n[\s\S]*?\n```/, '').trim();
        }
      }
    } catch (e) {
      console.error('Failed to parse tool call from response:', e);
    }
  }
  
  // 明示的に渡されたツール呼び出し情報がある場合はそれを優先
  const finalToolCalls = toolCalls || toolCallsDetected;

  if (isStreaming) {
    // ストリーミング用のチャンクフォーマット
    const responseObj: AnthropicMessageChunk = {
      id: randomId,
      type: 'message',
      role: 'assistant',
      content: response.isComplete || responseContent === undefined
        ? [{ type: 'text', text: responseContent }]
        : [{ type: 'text', text: responseContent }],
      model: modelId,
      stop_reason: response.isComplete ? 'end_turn' : null,
      stop_sequence: null,
      usage: {
        input_tokens: 0,  // VSCode APIではトークン数が取得できないため0を返す
        output_tokens: 0
      },
      container: null
    };
    
    // ツール呼び出しがあれば追加
    if (finalToolCalls && finalToolCalls.length > 0) {
      (responseObj as any).tool_calls = finalToolCalls;
    }
    
    return responseObj;
  } else {
    // 通常のレスポンスフォーマット
    const responseObj: AnthropicMessageResponse = {
      id: randomId,
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: responseContent }],
      model: modelId,
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 0,  // VSCode APIではトークン数が取得できないため0を返す
        output_tokens: 0
      },
      container: null
    };
    
    // ツール呼び出しがあれば追加
    if (finalToolCalls && finalToolCalls.length > 0) {
      (responseObj as any).tool_calls = finalToolCalls;
    }
    
    return responseObj;
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
export async function getAnthropicModels(): Promise<AnthropicModelsResponse> {
  try {
    // modelManagerから生のモデル一覧を取得
    const availableModels = await modelManager.getAvailableModels();
    
    // VSCode LM APIのモデルデータをAnthropic形式に変換
    const models: AnthropicModel[] = availableModels.map((model) => {
      return {
        id: model.id,
        type: 'model',
        display_name: model.name,
        created_at: new Date().toISOString()
      };
    });
    
    // プロキシモデルも追加
    models.push({
      id: 'vscode-lm-proxy',
      type: 'model',
      display_name: 'VSCode LM Proxy',
      created_at: new Date().toISOString()
    });
    
    // Claude Codeのモデル定義を追加
    models.push({
      id: 'claude-3-opus-20240229',
      type: 'model',
      display_name: 'Claude 3 Opus',
      created_at: new Date().toISOString(),
      capabilities: {
        tools: true,
        functions: true,
        tool_conversation: true,
        vision: true
      },
      context_window: 200000,
      max_tokens: 4096
    });
    
    models.push({
      id: 'claude-3-sonnet-20240229',
      type: 'model',
      display_name: 'Claude 3 Sonnet',
      created_at: new Date().toISOString(),
      capabilities: {
        tools: true,
        functions: true,
        tool_conversation: true,
        vision: true
      },
      context_window: 200000,
      max_tokens: 4096
    });
    
    models.push({
      id: 'claude-3-haiku-20240307',
      type: 'model',
      display_name: 'Claude 3 Haiku',
      created_at: new Date().toISOString(),
      capabilities: {
        tools: true,
        functions: true,
        tool_conversation: true,
        vision: true
      },
      context_window: 200000,
      max_tokens: 4096
    });
    
    return {
      data: models,
      first_id: models.length > 0 ? models[0].id : null,
      last_id: models.length > 0 ? models[models.length - 1].id : null,
      has_more: false
    };
  } catch (error) {
    console.error('Error fetching Anthropic models:', error);
    
    // エラーが発生した場合はデフォルトのモデルリストを返す
    const now = new Date().toISOString();
    return {
      data: [
        {
          id: 'vscode-lm-proxy',
          type: 'model',
          display_name: 'VSCode LM Proxy',
          created_at: now
        },
        {
          id: 'claude-3-opus-20240229',
          type: 'model',
          display_name: 'Claude 3 Opus',
          created_at: now,
          capabilities: {
            tools: true,
            functions: true,
            tool_conversation: true,
            vision: true
          },
          context_window: 200000,
          max_tokens: 4096
        }
      ],
      first_id: 'vscode-lm-proxy',
      last_id: 'claude-3-opus-20240229',
      has_more: false
    };
  }
}

/**
 * 特定のモデルIDに対応するAnthropic API形式のモデル情報を返す
 * @param modelId モデルID
 * @returns Anthropic API形式のモデル情報
 */
export async function getAnthropicModelInfo(modelId: string): Promise<AnthropicModel | null> {
  try {
    // モデルIDに対応するモデル情報を返す
    const modelsResponse = await getAnthropicModels();
    const models = modelsResponse.data;
    return models.find((model: AnthropicModel) => model.id === modelId) || null;
  } catch (error) {
    console.error(`Error fetching model info for ${modelId}:`, error);
    return null;
  }
}

/**
 * Anthropic Messages APIリクエストのバリデーション
 * @param body リクエストボディ
 * @returns 検証済みのリクエストパラメータ
 */
export function validateAndConvertAnthropicRequest(body: any): {
  vscodeLmMessages: vscode.LanguageModelChatMessage[];
  model: string;
  stream?: boolean;
  originalMessages: any[];
  tools?: any[];
  toolChoice?: any;
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

  // メッセージをVSCode形式に変換
  let vscodeLmMessages: vscode.LanguageModelChatMessage[] = [];
  
  // システムプロンプトがあれば、最初のユーザーメッセージとして追加
  if (body.system) {
    let systemContent = '';
    if (typeof body.system === 'string') {
      systemContent = body.system;
    } else if (Array.isArray(body.system)) {
      // 配列形式のシステムプロンプトを文字列に変換
      systemContent = body.system
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');
    }
    
    if (systemContent) {
      // システムプロンプトをユーザーメッセージとして先頭に追加
      vscodeLmMessages.push(vscode.LanguageModelChatMessage.User(`[SYSTEM] ${systemContent}`));
    }
  }
  
  // メッセージの変換
  for (const msg of body.messages) {
    // contentが配列の場合は、textのみを抽出
    let content = msg.content;
    if (Array.isArray(content)) {
      content = content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');
    }
    
    if (msg.role === 'user') {
      vscodeLmMessages.push(vscode.LanguageModelChatMessage.User(content));
    } else if (msg.role === 'assistant') {
      vscodeLmMessages.push(vscode.LanguageModelChatMessage.Assistant(content));
    } else {
      // その他のロールはユーザーメッセージとして扱う
      vscodeLmMessages.push(vscode.LanguageModelChatMessage.User(`[${msg.role}] ${content}`));
    }
  }
  
  // モデルが'vscode-lm-proxy'の場合、選択されたモデルがあるか確認
  if (model === 'vscode-lm-proxy' && !modelManager.getOpenaiModelId()) {
    const error: any = new Error('No valid model selected. Please select a model first.');
    error.statusCode = 400;
    error.type = 'invalid_request_error';
    throw error;
  }
  
  // Claude Codeのツール関連情報を抽出
  const tools = body.tools || undefined;
  const toolChoice = body.tool_choice || undefined;
  
  // ツール情報がある場合、最後のシステムプロンプトとして追加
  if (tools && tools.length > 0) {
    // ツール情報を文字列に変換してシステムプロンプトに追加
    const toolsDescription = JSON.stringify(tools, null, 2);
    vscodeLmMessages.push(vscode.LanguageModelChatMessage.User(
      `[TOOLS] The following tools are available. Format tool calls as JSON: ${toolsDescription}`
    ));
  }
  
  return {
    vscodeLmMessages,
    model,
    stream: body.stream,
    originalMessages: body.messages,
    tools,
    toolChoice
  };
}
