import * as path from 'path';
import * as Mocha from 'mocha';
import { glob } from 'glob';

/**
 * テストスイートを実行するためのエントリポイント
 */
export function run(): Promise<void> {
  // テストのタイムアウトを設定（30秒）
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 30000,
  });

  const testsRoot = path.resolve(__dirname, '..');
  
  return new Promise<void>((resolve, reject) => {
    // すべてのテストファイルをグロブパターンで検索
    glob('**/**.test.js', { cwd: testsRoot })
      .then((files: string[]) => {
        // 見つかったテストファイルをすべてMochaに追加
        files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

        try {
          // テストを実行
          mocha.run((failures: number) => {
            if (failures > 0) {
              reject(new Error(`${failures} tests failed.`));
            } else {
              resolve();
            }
          });
        } catch (err) {
          reject(err);
        }
      })
      .catch((err: Error) => reject(err));
  });
}
