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
       * 指定したベンダーのモデルを含める
       */
      vendor?: string;
      /**
       * 指定したモデルファミリーを含める
       */
      family?: string;
      /**
       * 指定したIDのモデルを含める
       */
      id?: string;
      /**
       * 指定したバージョンのモデルを含める
       */
      version?: string;
    }

    /**
     * 言語モデルチャットメッセージ
     */
    export class LanguageModelChatMessage {
      constructor(role: string, content: string);
      static User(content: string): LanguageModelChatMessage;
      static Assistant(content: string): LanguageModelChatMessage;
      role: string;
      content: string;
    }

    /**
     * 言語モデルチャットレスポンス
     */
    export interface LanguageModelChatResponse {
      text: AsyncIterableIterator<string>;
    }

    /**
     * 言語モデル情報
     */
    export interface LanguageModelChat {
      id: string;
      name: string;
      maxInputTokens: number;
      sendRequest(
        messages: LanguageModelChatMessage[],
        options: object,
        token: vscode.CancellationToken
      ): Promise<LanguageModelChatResponse>;
    }

    /**
     * チャットモデルを選択
     */
    export function selectChatModels(options?: LanguageModelChatSelector): Promise<LanguageModelChat[]>;
  }

  /**
   * 言語モデルエラー（VSCodeのオリジナル定義がある場合は削除）
   */
  // export class LanguageModelError extends Error {
  //   readonly code: string;
  //   readonly cause?: Error;
  // }
}
