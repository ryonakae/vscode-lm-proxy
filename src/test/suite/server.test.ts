import * as assert from 'assert';
import * as vscode from 'vscode';
import * as http from 'http';
import { serverManager } from '../../server/manager';
import { executeCommand, sleep } from '../testHelper';

/**
 * サーバー機能の単体テスト
 */
suite('Server Tests', () => {
  // テスト前後の処理
  suiteSetup(async () => {
    // サーバーが実行中の場合は停止
    if (serverManager.isRunning()) {
      await serverManager.stop();
    }
  });
  
  suiteTeardown(async () => {
    // テスト終了後にサーバーを停止
    if (serverManager.isRunning()) {
      await serverManager.stop();
    }
  });
  
  // サーバーの起動テスト
  test('Server Start and Stop', async () => {
    // サーバーを起動
    await serverManager.start();
    
    // サーバーが起動していることを確認
    assert.strictEqual(serverManager.isRunning(), true, 'サーバーは起動しているはずです');
    
    // サーバーが実際にポート4000で待ち受けていることを確認
    const serverResponds = await new Promise<boolean>((resolve) => {
      const req = http.request({
        hostname: 'localhost',
        port: 4000,
        path: '/',
        method: 'GET'
      }, (_res) => {
        // レスポンスがあれば成功
        resolve(true);
      });
      
      req.on('error', () => {
        // エラーが発生すれば失敗
        resolve(false);
      });
      
      req.end();
    });
    
    assert.strictEqual(serverResponds, true, 'サーバーはHTTPリクエストに応答するはずです');
    
    // サーバーを停止
    await serverManager.stop();
    
    // サーバーが停止していることを確認
    assert.strictEqual(serverManager.isRunning(), false, 'サーバーは停止しているはずです');
  });
  
  // サーバーの二重起動防止テスト
  test('Server Double Start Prevention', async () => {
    // サーバーを起動
    await serverManager.start();
    
    // 再度サーバーを起動しても問題ないことを確認
    await serverManager.start();
    
    // サーバーが起動していることを確認
    assert.strictEqual(serverManager.isRunning(), true, 'サーバーは起動しているはずです');
    
    // サーバーを停止
    await serverManager.stop();
  });
});
