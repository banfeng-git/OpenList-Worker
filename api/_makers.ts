import app, { setSpaFallbackHtml } from "../src/backend/index"
import INDEX_HTML from "../dist/index.html"
import {
  isBufferedJsonApiRequest,
  isStrictBodyPath,
  replayRequestBody,
} from "./_edgeone-body"

// 构建期内联 dist/index.html：EdgeOne Node 云函数没有 ASSETS 绑定，
// 前端路由（/add、/@manage/* 等静态不存在的路径）会落到 Hono 兜底，
// 注入后由函数直接返回 SPA 壳（配合根级 middleware.js 的边缘改写双保险）。
setSpaFallbackHtml(INDEX_HTML)

// EdgeOne 的 Node 运行时偶发丢失/截断 JSON 请求体（issue #170 / PR #158）。
// 处理方式：在适配器边界先把 body 读成 ArrayBuffer，再用全新 Request 交给
// Hono 重放；确实读不到时，严格路径返回 400，其余端点用空 body 继续走业务
// 逻辑（handler 自带兜底，前端可重试），不再整站 400。
export async function onRequest(context: any) {
  const request: Request = context.request
  const pathname = new URL(request.url).pathname

  if (!isBufferedJsonApiRequest(request)) {
    return app.fetch(request, context.env, context)
  }

  let body: ArrayBuffer
  try {
    body = await request.arrayBuffer()
  } catch (err) {
    const strict = isStrictBodyPath(pathname)
    console.warn("[edgeone] failed to buffer JSON request body", {
      method: request.method.toUpperCase(),
      path: pathname,
      contentLength: request.headers.get("content-length"),
      strict,
      error: err instanceof Error ? err.message : String(err),
    })
    if (strict) {
      return new Response(
        JSON.stringify({
          code: 400,
          message: "failed to read request body",
          data: null,
        }),
        {
          status: 400,
          headers: { "content-type": "application/json; charset=UTF-8" },
        },
      )
    }
    return app.fetch(replayRequestBody(request, null), context.env, context)
  }

  return app.fetch(replayRequestBody(request, body), context.env, context)
}

export default onRequest
