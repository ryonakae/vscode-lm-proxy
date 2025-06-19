// VSCode Language Model API型定義拡張
import * as vscode from 'vscode';

declare module 'vscode' {
  /**
   * VSCode Language Model API関連の型定義
   */
  export namespace lm {
    /**
     * チャットモデル選択オプション
     */
    export interface LanguageModelChatSelector {
      /**
       * 含めるモデルファミリー
       */
      includeFamily?: string[];
    }

    /**
     * 言語モデルチャットメッセージ
     */
    export class LanguageModelChatMessage {
      constructor(role: string, content: string);
      role: string;
      content: string;
    }

    /**
     * 言語モデルチャット完了アイテム
     */
    export interface LanguageModelChatCompletionItem {
      content: string;
      isComplete?: boolean;
    }

    /**
     * モデル情報
     */
    export interface LanguageModelInfo {
      id: string;
      name: string;
    }

    /**
     * チャットモデルを選択
     */
    export function selectChatModels(options?: LanguageModelChatSelector): Promise<LanguageModelInfo[]>;

    /**
     * チャットリクエストを送信
     */
    export function sendChatRequest(
      model: { id: string },
      messages: vscode.LanguageModelChatMessage[]
    ): Promise<LanguageModelChatCompletionItem>;

    /**
     * ストリーミングチャットリクエストを送信
     */
    export function sendChatRequestStream(
      model: { id: string },
      messages: vscode.LanguageModelChatMessage[]
    ): Promise<AsyncIterableIterator<LanguageModelChatCompletionItem>>;
  }
}
