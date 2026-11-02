// ESA（阿里云边缘函数）运行时不是 Node，全局没有 process。
//
// 后端 4.2.x 在若干处读取 process.env（例如 src/backend/server/assets.ts 里的
//   String(env?.ASSET_URLS || process.env?.ASSET_URLS || "")
// ）。在 ESA 上这句会抛 ReferenceError: process is not defined，而它被
// SPA 兜底分支（cdnAssetRedirect / isCdnConfigured）无条件调用，于是
// /@manage、/@init、任何非静态路径全部 500，只有静态的 / 和 /api/* 正常。
//
// 在入口最早期注入一个最小垫片：env 为空对象即可，让 ASSET_URLS 退化为未配置。
const g: any = globalThis as any

if (typeof g.process === "undefined") {
  g.process = {
    env: {},
    argv: [],
    platform: "esa",
    arch: "edge",
    version: "",
    versions: {},
    pid: 1,
    title: "esa",
    browser: false,
    cwd: () => "/",
    chdir: () => {},
    nextTick: (fn: any, ...args: any[]) => {
      setTimeout(() => fn(...args), 0)
    },
    hrtime: () => [Math.floor(Date.now() / 1000), 0],
    uptime: () => 0,
    memoryUsage: () => ({ rss: 0, heapTotal: 0, heapUsed: 0, external: 0 }),
    on: () => {},
    off: () => {},
    once: () => {},
    emit: () => false,
    exit: () => {},
    kill: () => {},
    stdout: { write: () => true, isTTY: false },
    stderr: { write: () => true, isTTY: false },
  }
}

export {}
