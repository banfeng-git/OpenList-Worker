// EdgeOne Node 运行时偶发（上游实测约 40% 的 POST）不把请求体交付给应用：
// 平台提供的一次性 body 流穿过中间层后在 Hono 里不可读，c.req.text() 抛异常，
// jsonBodyGuard 便返回 400 "failed to read request body"（issue #170 / PR #156、#158）。
//
// 这里在适配器边界把 JSON 请求体先读成定长实体，再用一个全新的 Request 交给
// Hono，保证应用侧拿到完整、可重放的 body。

export function isBufferedJsonApiRequest(request: Request): boolean {
  const method = request.method.toUpperCase()
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return false

  const contentType = (request.headers.get("content-type") || "").toLowerCase()
  if (!contentType.includes("application/json")) return false

  const pathname = new URL(request.url).pathname
  if (!pathname.startsWith("/api")) return false
  // /api/task/* 由 EdgeOne Schedules 调度，payload 由平台注入，保持原样。
  if (pathname.startsWith("/api/task/")) return false

  return request.body !== null
}

// 缓冲后已是定长实体，按新实体交给运行时重新计算长度，避免原请求的
// chunked / content-length 标记与新 body 冲突。
export function replayRequestBody(
  request: Request,
  body: ArrayBuffer | null,
): Request {
  const headers = new Headers(request.headers)
  headers.delete("transfer-encoding")
  headers.delete("content-length")

  return new Request(request.url, {
    method: request.method,
    headers,
    body: body && body.byteLength > 0 ? body : undefined,
    signal: request.signal,
  })
}

export function isStrictBodyPath(pathname: string): boolean {
  return pathname.startsWith("/api/fs") || pathname.startsWith("/api/share")
}
