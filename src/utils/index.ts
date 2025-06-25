/**
 * ランダムなIDを生成
 * @returns ランダム文字列
 */
export function generateRandomId(): string {
  return Math.random().toString(36).substring(2, 12);
}