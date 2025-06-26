import type express from 'express'

/**
 * Anthropic互換APIのルートエンドポイントを設定する
 * @param {express.Express} app Express.jsアプリケーション
 * @returns {void}
 */
export function setupAnthropicEndpoints(app: express.Express): void {
  app.get('/anthropic', handleAnthropicRootResponse)
  app.get('/anthropic/v1', handleAnthropicRootResponse)
  app.get('/anthropic/v1/', handleAnthropicRootResponse)
}

/**
 * Anthropic互換のMessages APIエンドポイントを設定する
 * @param {express.Express} app Express.jsアプリケーション
 * @returns {void}
 */
export function setupAnthropicMessagesEndpoints(app: express.Express): void {
  // Anthropic API互換エンドポイントを登録
  app.post('/anthropic/messages', handleAnthropicMessages)
  app.post('/anthropic/v1/messages', handleAnthropicMessages)
}

/**
 * Anthropic互換のModels APIエンドポイントを設定する
 * @param {express.Express} app Express.jsアプリケーション
 * @returns {void}
 */
export function setupAnthropicModelsEndpoints(app: express.Express): void {
  // モデル一覧エンドポイント
  app.get('/anthropic/models', handleAnthropicModels)
  app.get('/anthropic/v1/models', handleAnthropicModels)

  // 特定モデル情報エンドポイント
  app.get('/anthropic/models/:model', handleAnthropicModelInfo)
  app.get('/anthropic/v1/models/:model', handleAnthropicModelInfo)
}

/**
 * Anthropic互換APIのルートエンドポイントのレスポンスを返す
 * @param {express.Request} req リクエスト
 * @param {express.Response} res レスポンス
 * @returns {void}
 */
function handleAnthropicRootResponse(
  _req: express.Request,
  res: express.Response,
) {
  res.json({ status: 'ok' })
}

/**
 * Anthropic互換のMessages APIリクエストを処理するメイン関数。
 * - リクエストバリデーション
 * - モデル取得
 * - LM APIへのリクエスト送信
 * - ストリーミング/非ストリーミングレスポンス処理
 * - エラーハンドリング
 * @param {express.Request} req リクエスト
 * @param {express.Response} res レスポンス
 * @returns {Promise<void>}
 */
async function handleAnthropicMessages() {}

/**
 * Anthropic互換のモデル一覧リクエストを処理する
 * @param {express.Request} req リクエスト
 * @param {express.Response} res レスポンス
 * @returns {Promise<void>}
 */
async function handleAnthropicModels() {}

/**
 * Anthropic互換の単一モデル情報リクエストを処理する
 * @param {express.Request} req リクエスト
 * @param {express.Response} res レスポンス
 * @returns {Promise<void>}
 */
async function handleAnthropicModelInfo() {}
