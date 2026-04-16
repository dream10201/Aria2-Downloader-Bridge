const DEFAULT_CONFIG = {
  enabled: true,
  autoPrompt: true,
  rpcProtocol: "wss",
  rpcHost: "",
  rpcPort: 443,
  rpcPath: "/jsonrpc",
  rpcSecret: "",
  downloadDir: "",
  userAgentMode: "browser",
};

const pendingDecisions = new Map();
const requestHeadersByUrl = new Map();
const requestHeadersByRequestId = new Map();
const activePrompts = new Map();
const ignoredDownloadUrls = new Map();
const pendingIntercepts = new Map();
const EXCLUDED_APPLICATION_TYPES = new Set([
  "json",
  "xml",
  "javascript",
  "x-javascript",
  "ecmascript",
  "x-ecmascript",
  "xhtml+xml",
]);

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url || "";
  }
}

function looksLikeFileName(value) {
  if (!value) {
    return false;
  }

  const candidate = String(value).trim().replace(/\\/g, "/").split("/").pop() || "";
  if (!candidate) {
    return false;
  }

  if (/[<>:"|?*\r\n]/.test(candidate)) {
    return false;
  }

  return /\.[a-z0-9]{1,12}$/i.test(candidate);
}

function extractFileName(value, fallbackUrl = "") {
  if (value && looksLikeFileName(value)) {
    const normalized = String(value).replace(/\\/g, "/");
    const name = normalized.split("/").pop();
    if (name) {
      return name;
    }
  }

  if (fallbackUrl) {
    try {
      const parsed = new URL(fallbackUrl);
      const name = parsed.pathname.split("/").pop();
      if (name) {
        return decodeURIComponent(name);
      }
    } catch {
      // 忽略 URL 解析失败，交给调用方决定是否留空。
    }
  }

  return "";
}

function cloneHeaders(headers = []) {
  return headers
    .filter((header) => header && header.name)
    .map((header) => ({
      name: header.name,
      value: header.value ?? "",
    }));
}

function headersToMap(headers = []) {
  const map = new Map();
  for (const header of headers) {
    map.set(header.name.toLowerCase(), header.value ?? "");
  }
  return map;
}

function pickUsefulHeaders(headers = []) {
  const allowed = new Set([
    "cookie",
    "authorization",
    "referer",
    "origin",
    "user-agent",
    "accept",
    "accept-language",
    "range",
  ]);

  return cloneHeaders(headers).filter((header) =>
    allowed.has(header.name.toLowerCase())
  );
}

function hasDownloadDisposition(headers = []) {
  return headers.some((header) => {
    if (!header?.name || !header?.value) {
      return false;
    }
    return (
      header.name.toLowerCase() === "content-disposition" &&
      /attachment/i.test(header.value)
    );
  });
}

function parseContentType(headers = []) {
  const header = headers.find((item) => item?.name?.toLowerCase() === "content-type");
  if (!header?.value) {
    return "";
  }

  return header.value.split(";")[0].trim().toLowerCase();
}

function isIncludedDownloadContentType(contentType) {
  if (!contentType) {
    return false;
  }
  if (contentType.startsWith("audio/") || contentType.startsWith("video/")) {
    return true;
  }
  if (!contentType.startsWith("application/")) {
    return false;
  }

  let normalized = contentType.slice("application/".length);
  const plusIndex = normalized.lastIndexOf("+");
  if (plusIndex !== -1) {
    normalized = normalized.slice(plusIndex + 1);
  }

  if (EXCLUDED_APPLICATION_TYPES.has(normalized)) {
    return false;
  }

  return true;
}

function hasByteRangeSupport(headers = []) {
  return headers.some((header) => {
    if (!header?.name || !header?.value) {
      return false;
    }
    return (
      header.name.toLowerCase() === "accept-ranges" &&
      header.value.toLowerCase() === "bytes"
    );
  });
}

function hasContentLength(headers = []) {
  return headers.some((header) => {
    if (!header?.name || !header?.value) {
      return false;
    }
    return (
      header.name.toLowerCase() === "content-length" &&
      Number.isFinite(Number(header.value))
    );
  });
}

function shouldPromptFromResponseHeaders(headers = []) {
  const isAttachment = hasDownloadDisposition(headers);
  const contentType = parseContentType(headers);
  const contentTypeIncluded = isIncludedDownloadContentType(contentType);
  const acceptRanges = hasByteRangeSupport(headers);
  const hasLength = hasContentLength(headers);

  if (isAttachment) {
    return true;
  }

  if (!contentTypeIncluded) {
    return false;
  }

  return acceptRanges || hasLength;
}

function getSuggestedFilename(headers = [], url = "") {
  const header = headers.find(
    (item) => item?.name?.toLowerCase() === "content-disposition" && item.value
  );
  if (header) {
    const utf8Match = header.value.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match) {
      return extractFileName(decodeURIComponent(utf8Match[1]), url);
    }
    const plainMatch = header.value.match(/filename="?([^";]+)"?/i);
    if (plainMatch) {
      return extractFileName(plainMatch[1], url);
    }
  }

  return extractFileName("", url);
}

async function getConfig() {
  const stored = await browser.storage.local.get("config");
  return {
    ...DEFAULT_CONFIG,
    ...(stored.config || {}),
  };
}

async function setConfig(config) {
  await browser.storage.local.set({ config });
}

async function ensureConfig() {
  const config = await getConfig();
  await setConfig(config);
}

function buildRpcUrl(config) {
  const protocol = config.rpcProtocol || "ws";
  const host = config.rpcHost || "127.0.0.1";
  const port = config.rpcPort ? `:${config.rpcPort}` : "";
  const path = config.rpcPath?.startsWith("/") ? config.rpcPath : `/${config.rpcPath || "jsonrpc"}`;
  return `${protocol}://${host}${port}${path}`;
}

function jsonRpcCall(endpoint, payload) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("连接 aria2 超时"));
    }, 15000);

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify(payload));
    });

    socket.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);
        clearTimeout(timeout);
        socket.close();

        if (data.error) {
          reject(new Error(data.error.message || "aria2 返回错误"));
          return;
        }

        resolve(data.result);
      } catch (error) {
        reject(error);
      }
    });

    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("无法连接 aria2 RPC"));
    });

    socket.addEventListener("close", () => {
      clearTimeout(timeout);
    });
  });
}

async function getCookiesHeader(url) {
  try {
    const cookies = await browser.cookies.getAll({ url });
    if (!cookies.length) {
      return "";
    }

    return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  } catch {
    return "";
  }
}

async function buildAria2Headers(url, context = {}) {
  const config = await getConfig();
  const normalizedUrl = normalizeUrl(url);
  const capturedHeaders = pickUsefulHeaders(
    context.capturedHeaders ||
      requestHeadersByUrl.get(normalizedUrl) ||
      requestHeadersByUrl.get(url) ||
      []
  );
  const headerMap = headersToMap(capturedHeaders);

  const cookieHeader = headerMap.get("cookie") || (await getCookiesHeader(url));
  const refererHeader = headerMap.get("referer") || context.referer || "";
  const originHeader = headerMap.get("origin") || (() => {
    if (!refererHeader) {
      return "";
    }
    try {
      return new URL(refererHeader).origin;
    } catch {
      return "";
    }
  })();
  const userAgentHeader =
    config.userAgentMode === "browser"
      ? navigator.userAgent
      : headerMap.get("user-agent") || navigator.userAgent;

  const aria2Headers = [];
  if (cookieHeader) {
    aria2Headers.push(`Cookie: ${cookieHeader}`);
  }
  if (refererHeader) {
    aria2Headers.push(`Referer: ${refererHeader}`);
  }
  if (originHeader) {
    aria2Headers.push(`Origin: ${originHeader}`);
  }
  if (userAgentHeader) {
    aria2Headers.push(`User-Agent: ${userAgentHeader}`);
  }

  const passThrough = ["authorization", "accept", "accept-language", "range"];
  for (const key of passThrough) {
    const value = headerMap.get(key);
    if (value) {
      const headerName = key
        .split("-")
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join("-");
      aria2Headers.push(`${headerName}: ${value}`);
    }
  }

  return aria2Headers;
}

async function sendToAria2(url, context = {}) {
  const config = await getConfig();
  const headers = await buildAria2Headers(url, context);
  const options = {};

  if (headers.length) {
    options.header = headers;
  }
  if (config.downloadDir) {
    options.dir = config.downloadDir;
  }
  if (context.filename) {
    const cleanName = extractFileName(context.filename, url);
    if (cleanName) {
      options.out = cleanName;
    }
  }

  const payload = {
    jsonrpc: "2.0",
    id: `aria2-${Date.now()}`,
    method: "aria2.addUri",
    params: [
      `token:${config.rpcSecret}`,
      [url],
      options,
    ],
  };

  return jsonRpcCall(buildRpcUrl(config), payload);
}

async function createPromptFromIntercept(payload) {
  const promptId = crypto.randomUUID();
  pendingDecisions.set(promptId, {
    type: payload.type || "intercepted-download",
    url: payload.url,
    filename: extractFileName(payload.filename || "", payload.url),
    referrer: payload.referrer || "",
    tabId: payload.tabId,
    capturedHeaders: payload.capturedHeaders || [],
  });

  const popup = await browser.windows.create({
    url: browser.runtime.getURL(`confirm.html?id=${encodeURIComponent(promptId)}`),
    type: "popup",
    width: 620,
    height: 430,
  });
  activePrompts.set(promptId, popup.id);
}

async function promptForContextLink(info, tab) {
  const promptId = crypto.randomUUID();
  pendingDecisions.set(promptId, {
    type: "context-link",
    url: info.linkUrl,
    filename: "",
    referrer: info.pageUrl || tab?.url || "",
  });

  const popup = await browser.windows.create({
    url: browser.runtime.getURL(`confirm.html?id=${encodeURIComponent(promptId)}`),
    type: "popup",
    width: 620,
    height: 430,
  });
  activePrompts.set(promptId, popup.id);
}

async function restartBrowserDownload(pending) {
  const headers = await buildAria2Headers(pending.url, pending);
  const firefoxHeaders = headers.map((line) => {
    const index = line.indexOf(":");
    return {
      name: line.slice(0, index).trim(),
      value: line.slice(index + 1).trim(),
    };
  });

  ignoredDownloadUrls.set(normalizeUrl(pending.url), Date.now());
  const downloadId = await browser.downloads.download({
    url: pending.url,
    filename: extractFileName(pending.filename, pending.url) || undefined,
    saveAs: false,
    headers: firefoxHeaders,
  });
}

async function openTabDownload(pending) {
  if (Number.isInteger(pending.tabId) && pending.tabId >= 0) {
    ignoredDownloadUrls.set(normalizeUrl(pending.url), Date.now());
    await browser.tabs.update(pending.tabId, { url: pending.url });
    return;
  }

  await restartBrowserDownload(pending);
}

browser.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (!details.url.startsWith("http")) {
      return {};
    }

    const normalizedUrl = normalizeUrl(details.url);
    const headers = pickUsefulHeaders(details.requestHeaders || []);
    requestHeadersByRequestId.set(details.requestId, {
      url: normalizedUrl,
      headers,
      time: Date.now(),
    });
    requestHeadersByUrl.set(normalizedUrl, headers);
    return { requestHeaders: details.requestHeaders };
  },
  { urls: ["<all_urls>"] },
  ["blocking", "requestHeaders"]
);

browser.webRequest.onCompleted.addListener(
  (details) => {
    requestHeadersByRequestId.delete(details.requestId);
  },
  { urls: ["<all_urls>"] }
);

browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    const configPromise = getConfig();
    return configPromise.then(async (config) => {
      if (!config.enabled || !config.autoPrompt) {
        return {};
      }
      if (!["main_frame", "sub_frame"].includes(details.type)) {
        return {};
      }
      if (!(details.statusCode >= 200 && details.statusCode < 300)) {
        return {};
      }
      if (!/^https?:/i.test(details.url)) {
        return {};
      }

      const normalizedUrl = normalizeUrl(details.url);
      if (ignoredDownloadUrls.has(normalizedUrl)) {
        ignoredDownloadUrls.delete(normalizedUrl);
        return {};
      }

      const responseHeaders = details.responseHeaders || [];
      const isDownloadResponse = shouldPromptFromResponseHeaders(responseHeaders);

      if (!isDownloadResponse) {
        return {};
      }

      const requestMeta = requestHeadersByRequestId.get(details.requestId);
      const requestHeaders = requestMeta?.headers || [];
      pendingIntercepts.set(normalizedUrl, {
        type: "intercepted-download",
        url: details.url,
        filename: getSuggestedFilename(responseHeaders, details.url),
        referrer: details.originUrl || details.documentUrl || "",
        tabId: details.tabId,
        capturedHeaders: requestHeaders,
        time: Date.now(),
      });

      createPromptFromIntercept(pendingIntercepts.get(normalizedUrl)).catch(() => undefined);
      return { cancel: true };
    });
  },
  { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] },
  ["blocking", "responseHeaders"]
);

browser.webRequest.onErrorOccurred.addListener(
  (details) => {
    requestHeadersByRequestId.delete(details.requestId);
  },
  { urls: ["<all_urls>"] }
);

browser.contextMenus.create({
  id: "send-link-to-aria2",
  title: "用 aria2 下载该链接",
  contexts: ["link"],
});

browser.contextMenus.create({
  id: "open-aria2-options",
  title: "Aria2 下载设置",
  contexts: ["browser_action"],
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "send-link-to-aria2" && info.linkUrl) {
    await promptForContextLink(info, tab);
    return;
  }

  if (info.menuItemId === "open-aria2-options") {
    await browser.runtime.openOptionsPage();
  }
});

browser.browserAction.onClicked.addListener(async () => {
  await browser.runtime.openOptionsPage();
});

browser.runtime.onMessage.addListener((message) => {
  if (!message || typeof message !== "object") {
    return undefined;
  }

  if (message.type === "get-config") {
    return getConfig();
  }

  if (message.type === "save-config") {
    return setConfig({
      ...DEFAULT_CONFIG,
      ...(message.payload || {}),
    }).then(() => ({ ok: true }));
  }

  if (message.type === "get-pending") {
    return Promise.resolve(pendingDecisions.get(message.id) || null);
  }

  if (message.type === "confirm-download") {
    return (async () => {
      const pending = pendingDecisions.get(message.id);
      if (!pending) {
        throw new Error("请求已失效");
      }

      if (message.payload && typeof message.payload === "object") {
        pending.filename = extractFileName(message.payload.filename || "", pending.url);
        pending.referrer = message.payload.referrer || pending.referrer || "";
      }

      if (pending.type === "context-link" || pending.type === "intercepted-download") {
        if (message.action === "browser") {
          await openTabDownload(pending);
          pendingDecisions.delete(message.id);
          return { ok: true, mode: "browser" };
        }

        if (message.action === "aria2") {
          await sendToAria2(pending.url, pending);
          pendingDecisions.delete(message.id);
          return { ok: true, mode: "aria2" };
        }
      }

      pendingDecisions.delete(message.id);
      return { ok: true, mode: "cancelled" };
    })();
  }

  if (message.type === "close-prompt") {
    const windowId = activePrompts.get(message.id);
    activePrompts.delete(message.id);
    pendingDecisions.delete(message.id);
    if (windowId) {
      return browser.windows.remove(windowId).catch(() => undefined);
    }
  }

  return undefined;
});

async function cleanupHeaderCache() {
  const expireBefore = Date.now() - 5 * 60 * 1000;
  for (const [requestId, item] of requestHeadersByRequestId.entries()) {
    if (item.time < expireBefore) {
      requestHeadersByRequestId.delete(requestId);
    }
  }

  for (const [url, time] of ignoredDownloadUrls.entries()) {
    if (time < expireBefore) {
      ignoredDownloadUrls.delete(url);
    }
  }

  for (const [url, item] of pendingIntercepts.entries()) {
    if (item.time < expireBefore) {
      pendingIntercepts.delete(url);
    }
  }
}

setInterval(cleanupHeaderCache, 60 * 1000);
ensureConfig();
