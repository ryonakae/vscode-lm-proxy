/**
 * ランダムなID文字列を生成します。
 * 主に一意な識別子が必要な場面で利用します。
 * @returns {string} 10桁のランダムな英数字文字列
 */
export function generateRandomId(): string {
  return Math.random().toString(36).substring(2, 12)
}
