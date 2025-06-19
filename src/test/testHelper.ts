import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

/**
 * テストスイート用のヘルパー関数群
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * テスト用の一時的なワークスペースを作成
 */
export async function createTestWorkspace(): Promise<vscode.WorkspaceFolder | undefined> {
  // 現在のワークスペースを使用
  return vscode.workspace.workspaceFolders?.[0];
}

/**
 * 拡張機能の特定のコマンドを実行
 */
export async function executeCommand(command: string): Promise<any> {
  return vscode.commands.executeCommand(command);
}

/**
 * アサーションヘルパー：期待通りの値であることを検証
 */
export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  assert.strictEqual(actual, expected, message);
}

/**
 * テスト用の一時的な設定を適用
 */
export async function updateConfiguration(section: string, value: any): Promise<void> {
  await vscode.workspace.getConfiguration().update(section, value, vscode.ConfigurationTarget.Global);
}

/**
 * テスト用に拡張機能の再アクティベート
 */
export async function reloadExtension(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.reloadWindow');
  // 拡張機能のアクティベーションを待機
  await sleep(2000);
}
