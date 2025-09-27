#!/usr/bin/env node
/**
 * 函数级详细中文注释：简易签名代理服务（无第三方依赖）
 * - 目标：在后端安全环境内使用商户密钥，代表商户调用 `mapi.php`；前端与链上不接触密钥
 * - 端口：默认 8888，可通过环境变量 PORT 覆盖
 * - 路由：
 *   - POST /proxy/epay/create  接收 JSON 入参，签名并以表单 POST 转发到 http://111.170.145.41/mapi.php
 *   - GET  /epay/notify        支付平台异步通知回调验签，幂等处理后返回 success（此处仅演示验签）
 * - 安全：允许 CORS 白名单来源；不记录密钥；仅内存短暂持有明文密钥
 * - KMS/凭据管理：函数 getMerchantKeyForPid 提供多种来源（优先云凭据管理；无 SDK 时退化为 ENV）
 */

import http from 'node:http'
import crypto from 'node:crypto'
import { URL } from 'node:url'

const PORT = Number(process.env.PORT || 8888)
const UPSTREAM_BASE = process.env.MAPI_BASE || 'http://111.170.145.41'
const UPSTREAM_MAPI = `${UPSTREAM_BASE}/mapi.php`
const DEFAULT_NOTIFY_URL = process.env.NOTIFY_URL || 'http://127.0.0.1:8888/epay/notify'
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://127.0.0.1:5173').split(',')

/**
 * 函数级中文注释：读取请求体（支持 JSON 与 x-www-form-urlencoded）
 */
async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  const ct = req.headers['content-type'] || ''
  if (ct.includes('application/json')) {
    try { return JSON.parse(raw || '{}') } catch { return {} }
  }
  if (ct.includes('application/x-www-form-urlencoded')) {
    const obj = {}
    for (const [k, v] of new URLSearchParams(raw)) obj[k] = v
    return obj
  }
  return raw
}

/**
 * 函数级中文注释：统一设置 CORS 响应头（仅允许白名单来源）
 */
function applyCors(req, res) {
  const origin = req.headers.origin || ''
  if (CORS_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With')
  }
}

/**
 * 函数级中文注释：从阿里云凭据管理/KMS 或环境变量获取商户密钥
 * - 优先：若配置了 EPAY_SECRET_JSON_<pid>，直接解析 JSON { key }
 * - 次选：MERCHANT_KEY（单商户场景）
 * - 备注：若需对接阿里云 SDK，请在此函数中调用 GetSecretValue 并返回 { key }
 */
async function getMerchantKeyForPid(pid) {
  const envJson = process.env[`EPAY_SECRET_JSON_${pid}`]
  if (envJson) {
    try { const parsed = JSON.parse(envJson); if (parsed?.key) return String(parsed.key) } catch {}
  }
  const fallback = process.env.MERCHANT_KEY
  if (fallback) return String(fallback)
  throw new Error('商户密钥未配置：请设置 EPAY_SECRET_JSON_<pid> 或 MERCHANT_KEY')
}

/**
 * 函数级中文注释：按文档计算 MD5 签名（小写）
 * - 参与：非空参数；排除 sign/sign_type；键名 ASCII 升序；值不做 URL 编码
 * - 公式：md5(joined + KEY)
 */
function md5Sign(params, key) {
  const pairs = Object.entries(params)
    .filter(([k, v]) => k !== 'sign' && k !== 'sign_type' && v !== '' && v != null)
    .sort(([a],[b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
  return crypto.createHash('md5').update(pairs + key, 'utf8').digest('hex')
}

/**
 * 函数级中文注释：表单 POST 到上游 mapi.php，并解析 JSON 返回
 */
async function postFormToUpstream(url, form) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams(form).toString(),
  })
  const text = await resp.text()
  try { return { ok: resp.ok, json: JSON.parse(text) } } catch { return { ok: resp.ok, json: { raw: text } } }
}

/**
 * 函数级中文注释：创建订单代理（签名 + 转发）
 */
async function handleCreate(req, res) {
  try {
    const body = await readBody(req)
    const pid = String(body.pid || '')
    if (!pid) return json(res, 400, { code: -1, msg: 'missing pid' })

    const key = await getMerchantKeyForPid(pid)
    const payload = {
      pid,
      type: String(body.type || 'alipay'),
      out_trade_no: String(body.out_trade_no || ''),
      notify_url: String(body.notify_url || DEFAULT_NOTIFY_URL),
      return_url: String(body.return_url || ''),
      name: String(body.name || 'VIP会员'),
      money: String(Number(body.money).toFixed(2)),
      clientip: String(body.clientip || '127.0.0.1'),
      device: body.device ? String(body.device) : '',
      param: body.param ? String(body.param) : '',
    }
    const sign = md5Sign(payload, key)
    const upstream = await postFormToUpstream(UPSTREAM_MAPI, { ...payload, sign, sign_type: 'MD5' })
    return json(res, upstream.ok ? 200 : 502, upstream.json)
  } catch (e) {
    return json(res, 500, { code: -1, msg: String(e?.message || e) })
  }
}

/**
 * 函数级中文注释：回调验签（GET），验签通过返回 success
 */
async function handleNotify(req, res, url) {
  try {
    const qs = Object.fromEntries(url.searchParams.entries())
    const pid = String(qs.pid || '')
    const sign = String(qs.sign || '')
    const sign_type = String(qs.sign_type || 'MD5')
    if (!pid || !sign) return text(res, 400, 'bad request')
    if (sign_type.toUpperCase() !== 'MD5') return text(res, 400, 'bad sign_type')

    const key = await getMerchantKeyForPid(pid)
    const expect = md5Sign(qs, key)
    if (expect !== sign) return text(res, 400, 'invalid sign')
    if (String(qs.trade_status || '') !== 'TRADE_SUCCESS') return text(res, 400, 'bad trade_status')
    // 这里应做幂等更新订单状态；演示仅返回 success
    return text(res, 200, 'success')
  } catch (e) {
    return text(res, 500, 'error')
  }
}

/**
 * 函数级中文注释：通用 JSON 响应
 */
function json(res, status, obj) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json;charset=utf-8')
  res.end(JSON.stringify(obj))
}

/**
 * 函数级中文注释：通用文本响应
 */
function text(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/plain;charset=utf-8')
  res.end(body)
}

/**
 * 函数级中文注释：HTTP 服务器主处理
 */
const server = http.createServer(async (req, res) => {
  applyCors(req, res)
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end() }

  const url = new URL(req.url, `http://${req.headers.host}`)
  if (req.method === 'GET' && url.pathname === '/healthz') return json(res, 200, { ok: true })
  if (req.method === 'POST' && url.pathname === '/proxy/epay/create') return handleCreate(req, res)
  if (req.method === 'GET' && url.pathname === '/epay/notify') return handleNotify(req, res, url)

  res.statusCode = 404
  res.end('not found')
})

server.listen(PORT, () => {
  console.log(`[proxy-epay] listening on :${PORT} -> upstream=${UPSTREAM_MAPI}`)
})


