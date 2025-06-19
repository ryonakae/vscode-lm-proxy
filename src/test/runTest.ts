import * as path from 'path';
import * as vscode from 'vscode';
import { runTests } from '@vscode/test-electron';

/**
 * メインのテスト実行関数
 */
async function main() {
  try {
    // 拡張機能をテストする実行可能なVS Codeのパスを取得
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../');

    // テストスイートを実行するスクリプトのパス
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    // VSCodeを起動してテストを実行
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ['--disable-extensions'] // 他の拡張機能による影響を避ける
    });
  } catch (err) {
    console.error('テストの実行中にエラーが発生しました:', err);
    process.exit(1);
  }
}

// テストを実行
main();
