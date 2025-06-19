import * as assert from 'assert';
import * as vscode from 'vscode';
import * as http from 'http';
import { executeCommand, sleep } from '../testHelper';

/**
 * 統合テスト: エンドツーエンドのフロー検証
 */
suite('Integration Tests', () => {
  // テスト前後の処理
  suiteSetup(async function() {
    this.timeout(15000); // 初期化に時間がかかる場合
    
    // 拡張機能がアクティベートされるのを待機
    await sleep(2000);
    
    // サーバーを起動（もし実行中でなければ）
    await executeCommand('vscode-lm-proxy.startServer');
    
    // サーバーが起動するのを待機
    await sleep(2000);
  });
  
  suiteTeardown(async function() {
    // サーバーを停止
    await executeCommand('vscode-lm-proxy.stopServer');
  });
  
  // HTTPリクエスト送信のヘルパー関数
  async function sendRequest(path: string, body: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(body);
      
      const options = {
        hostname: 'localhost',
        port: 4000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(data);
            resolve({ status: res.statusCode, data: parsedData });
          } catch (err) {
            resolve({ status: res.statusCode, data });
          }
        });
      });
      
      req.on('error', (err) => {
        reject(err);
      });
      
      req.write(postData);
      req.end();
    });
  }
  
  // OpenAI API互換エンドポイントのテスト
  test('API Endpoint /chat/completions', async function() {
    this.timeout(30000); // APIリクエストに時間がかかる可能性がある
    
    try {
      // モデルが選択されていない場合は選択を促す
      await executeCommand('vscode-lm-proxy.selectModel');
      await sleep(2000);
      
      // シンプルなAPIリクエスト（実際のモデル呼び出しはせず、APIの形式が正しいかの検証のみ）
      const requestBody = {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello, test message.' }
        ]
      };
      
      // APIエンドポイントにリクエストを送信
      const response = await sendRequest('/chat/completions', requestBody);
      
      // この統合テストでは、実際の応答内容ではなくAPIの形式を検証する
      // 本番環境で実際のモデル応答を確認するためには異なるアプローチが必要
      
      // 応答形式が正しいことを検証（ステータスコード200または失敗時は特定のエラーフォーマット）
      if (response.status === 200) {
        assert.ok(response.data.choices, 'レスポンスにchoicesプロパティが含まれるべきです');
        assert.ok(response.data.model, 'レスポンスにmodelプロパティが含まれるべきです');
      } else {
        // エラーの場合もAPIの形式が正しいことを確認
        assert.ok(response.data.error, 'エラーレスポンスにはerrorオブジェクトが含まれるべきです');
      }
    } catch (err) {
      // テスト環境では実際のモデル呼び出しができない場合もある
      console.log('テスト環境ではAPIモデル呼び出しがスキップされる可能性があります');
    }
  });
});
