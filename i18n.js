const I18N_MESSAGES = {
  en: {
    options_page_title: "Aria2 Download Settings",
    options_hero_title: "Aria2 Download Settings",
    options_hero_lead:
      "Forward browser downloads to aria2 and include login-related headers and cookies whenever possible.",
    options_enabled: "Enable extension",
    options_auto_prompt: "Auto monitor browser downloads",
    options_rpc_protocol: "RPC protocol",
    options_host: "Host",
    options_port: "Port",
    options_path: "Path",
    options_secret: "RPC secret",
    options_download_dir: "aria2 download directory",
    options_download_dir_placeholder: "Optional",
    options_user_agent_mode: "User-Agent source",
    options_user_agent_browser: "Use extension runtime UA",
    options_user_agent_captured: "Prefer captured request UA",
    options_basic_headers_only: "Basic headers only",
    options_extra_header_names: "Additional forwarded header names",
    options_extra_header_names_placeholder:
      "One per line, or comma-separated, for example\nx-csrf-token\nx-requested-with",
    options_save: "Save settings",
    options_note_title: "Notes",
    options_note_primary:
      "Usually works for sites that depend on Cookie, Referer, or Authorization. It can still fail if the target validates client IP, TLS fingerprint, or one-time signatures.",
    options_note_secondary:
      "By default the extension forwards as many safe request headers as possible, while filtering headers such as Host, Content-Length, Connection, and Sec-Fetch-*. Enable Basic headers only to fall back to a conservative allowlist.",
    options_status_loaded: "Current settings loaded.",
    options_status_saved: "Settings saved.",
    options_status_load_failed: "Failed to load settings",

    confirm_page_title: "Choose Download Method",
    confirm_caption: "Download Intercepted",
    confirm_title: "Choose Download Method",
    confirm_close_aria: "Close",
    confirm_url: "Download URL",
    confirm_filename: "Filename",
    confirm_referrer: "Referrer",
    confirm_headers: "Headers sent to aria2 (click to expand)",
    confirm_reset_headers: "Restore auto-generated headers",
    confirm_warning:
      "Cookie, Referer, Authorization, User-Agent and other available headers will be included whenever possible.",
    confirm_hint:
      "aria2 can still fail if the site validates egress IP, expiring signatures, or browser fingerprinting.",
    confirm_browser: "Continue in browser",
    confirm_aria2: "Send to aria2",
    confirm_status_processing: "Processing...",
    confirm_status_aria2: "Sent to aria2.",
    confirm_status_browser: "Returned to browser download.",
    confirm_status_cancelled: "Cancelled.",
    confirm_status_missing_id: "Missing request id",
    confirm_status_expired: "Request expired",
    confirm_status_init_failed: "Initialization failed",
  },
  zh: {
    options_page_title: "Aria2 下载设置",
    options_hero_title: "Aria2 下载设置",
    options_hero_lead: "将浏览器下载自动转发给 aria2，并尽量携带当前登录态所需的请求头与 Cookie。",
    options_enabled: "启用扩展",
    options_auto_prompt: "自动监听浏览器下载",
    options_rpc_protocol: "RPC 协议",
    options_host: "主机",
    options_port: "端口",
    options_path: "路径",
    options_secret: "RPC 密钥",
    options_download_dir: "aria2 下载目录",
    options_download_dir_placeholder: "可留空",
    options_user_agent_mode: "User-Agent 来源",
    options_user_agent_browser: "使用扩展运行环境 UA",
    options_user_agent_captured: "优先使用抓到的请求 UA",
    options_basic_headers_only: "仅基础 Header",
    options_extra_header_names: "额外透传 Header 名称",
    options_extra_header_names_placeholder:
      "每行一个，或用逗号分隔，例如\nx-csrf-token\nx-requested-with",
    options_save: "保存设置",
    options_note_title: "说明",
    options_note_primary:
      "对依赖 Cookie、Referer、Authorization 的站点通常有效；如果目标站额外校验客户端 IP、TLS 指纹或一次性签名，aria2 端仍可能失败。",
    options_note_secondary:
      "默认会尽量透传当前请求里的全部安全 header，并过滤 Host、Content-Length、Connection、Sec-Fetch-* 等不适合转发的头。开启“仅基础 Header”后，才会退回到常见基础头白名单。",
    options_status_loaded: "已加载当前设置。",
    options_status_saved: "设置已保存。",
    options_status_load_failed: "设置读取失败",

    confirm_page_title: "选择下载方式",
    confirm_caption: "下载拦截",
    confirm_title: "选择下载方式",
    confirm_close_aria: "关闭",
    confirm_url: "下载地址",
    confirm_filename: "文件名",
    confirm_referrer: "来源页",
    confirm_headers: "发送给 aria2 的 Header（点击展开）",
    confirm_reset_headers: "恢复自动生成",
    confirm_warning: "会尽量附带 Cookie、Referer、Authorization、User-Agent 等请求头。",
    confirm_hint: "若目标站校验出口 IP、时效签名或浏览器指纹，aria2 端仍可能失败。",
    confirm_browser: "继续浏览器下载",
    confirm_aria2: "发送到 aria2",
    confirm_status_processing: "处理中...",
    confirm_status_aria2: "已发送到 aria2。",
    confirm_status_browser: "已交回浏览器下载。",
    confirm_status_cancelled: "已取消。",
    confirm_status_missing_id: "缺少请求标识",
    confirm_status_expired: "请求已过期",
    confirm_status_init_failed: "初始化失败",
  },
};

function getLocaleCode() {
  const language =
    (typeof browser !== "undefined" &&
      browser.i18n &&
      typeof browser.i18n.getUILanguage === "function" &&
      browser.i18n.getUILanguage()) ||
    navigator.language ||
    "en";
  return language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function createTranslator() {
  const locale = getLocaleCode();
  const messages = I18N_MESSAGES[locale] || I18N_MESSAGES.en;
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";

  function t(key) {
    return messages[key] || I18N_MESSAGES.en[key] || key;
  }

  function apply() {
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
    });
    document.querySelectorAll("[data-i18n-title]").forEach((element) => {
      element.setAttribute("title", t(element.dataset.i18nTitle));
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
    });
  }

  return { locale, t, apply };
}

window.appI18n = createTranslator();
