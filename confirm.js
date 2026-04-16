const params = new URLSearchParams(window.location.search);
const pendingId = params.get("id");

const elements = {
  url: document.getElementById("url"),
  filename: document.getElementById("filename"),
  referrer: document.getElementById("referrer"),
  browser: document.getElementById("browser"),
  aria2: document.getElementById("aria2"),
  cancel: document.getElementById("cancel"),
  status: document.getElementById("status"),
};
let suppressUnloadCleanup = false;

function setBusy(isBusy) {
  for (const button of [elements.browser, elements.aria2, elements.cancel]) {
    button.disabled = isBusy;
  }
}

function setStatus(message, state = "") {
  elements.status.textContent = message;
  if (state) {
    elements.status.dataset.state = state;
  } else {
    delete elements.status.dataset.state;
  }
}

async function closePrompt() {
  suppressUnloadCleanup = true;
  await browser.runtime.sendMessage({
    type: "close-prompt",
    id: pendingId,
  });
  window.close();
}

async function submit(action) {
  suppressUnloadCleanup = true;
  setBusy(true);
  setStatus("处理中...");
  try {
    const result = await browser.runtime.sendMessage({
      type: "confirm-download",
      id: pendingId,
      action,
      payload: {
        filename: elements.filename.value.trim(),
        referrer: elements.referrer.value.trim(),
      },
    });

    if (result.mode === "aria2") {
      setStatus("已发送到 aria2。", "success");
    } else if (result.mode === "browser") {
      setStatus("已交回浏览器下载。", "success");
    } else {
      setStatus("已取消。", "success");
    }

    setTimeout(() => window.close(), 500);
  } catch (error) {
    suppressUnloadCleanup = false;
    setBusy(false);
    setStatus(error.message || "处理失败", "error");
  }
}

async function loadPending() {
  if (!pendingId) {
    setStatus("缺少请求标识", "error");
    return;
  }

  const pending = await browser.runtime.sendMessage({
    type: "get-pending",
    id: pendingId,
  });

  if (!pending) {
    setStatus("请求已过期", "error");
    return;
  }

  elements.url.value = pending.url || "";
  elements.filename.value = pending.filename || "";
  elements.referrer.value = pending.referrer || "";

  if (pending.type === "context-link") {
    elements.browser.style.display = "none";
  }
}

elements.aria2.addEventListener("click", () => submit("aria2"));
elements.browser.addEventListener("click", () => submit("browser"));
elements.cancel.addEventListener("click", closePrompt);

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closePrompt().catch(() => undefined);
  }
});

window.addEventListener("beforeunload", () => {
  if (suppressUnloadCleanup) {
    return;
  }
  browser.runtime.sendMessage({
    type: "close-prompt",
    id: pendingId,
  }).catch(() => undefined);
});

loadPending().catch((error) => {
  setStatus(error.message || "初始化失败", "error");
});
