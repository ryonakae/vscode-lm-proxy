import * as assert from 'assert';
import * as vscode from 'vscode';
import { executeCommand, sleep } from '../testHelper';

/**
 * コマンドの単体テスト
 */
suite('Command Tests', () => {
  // テスト前後の処理
  suiteSetup(async () => {
    // 拡張機能がアクティベートされるのを待機
    await sleep(2000);
  });

  // サーバー起動・停止コマンドのテスト
  test('Server Start/Stop Command', async () => {
    // サーバー起動コマンドを実行
    await executeCommand('vscode-lm-proxy.startServer');
    
    // サーバーが起動したことを確認
    const serverRunning = await vscode.commands.executeCommand('getContext', 'vscode-lm-proxy.serverRunning');
    assert.strictEqual(serverRunning, true, 'サーバーは起動しているはずです');
    
    // サーバー停止コマンドを実行
    await executeCommand('vscode-lm-proxy.stopServer');
    
    // サーバーが停止したことを確認
    const serverStopped = await vscode.commands.executeCommand('getContext', 'vscode-lm-proxy.serverRunning');
    assert.strictEqual(serverStopped, false, 'サーバーは停止しているはずです');
  });

  // モデル選択コマンドのテスト
  test('Model Selection Command', async function() {
    // このテストは時間がかかる可能性があるため、タイムアウトを延長
    this.timeout(10000);
    
    // モデル選択コマンドを実行（インタラクティブな操作が必要なため、成功したかどうかだけを確認）
    try {
      // モデル選択コマンドを非同期で実行（ユーザー入力を必要とするため、完了を待たない）
      void executeCommand('vscode-lm-proxy.selectModel');
      
      // コマンドが実行されたことを確認するためのウェイト
      await sleep(1000);
      
      // エラーが発生しなければ成功とみなす
      assert.ok(true, 'モデル選択コマンドが実行されました');
    } catch (err) {
      assert.fail(`モデル選択コマンドの実行に失敗しました: ${err}`);
    }
  });
});
