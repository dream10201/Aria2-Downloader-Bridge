const params = new URLSearchParams(window.location.search);
const pendingId = params.get("id");

const elements = {
  url: document.getElementById("url"),
  filename: document.getElementById("filename"),
  referrer: document.getElementById("referrer"),
  headers: document.getElementById("headers"),
  resetHeaders: document.getElementById("resetHeaders"),
  browser: document.getElementById("browser"),
  aria2: document.getElementById("aria2"),
  cancel: document.getElementById("cancel"),
  status: document.getElementById("status"),
};
let suppressUnloadCleanup = false;
const i18n = window.appI18n;
let currentPending = null;

function parseHeaderLines(text) {
  return String(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(":");
      if (separator <= 0) {
        return "";
      }
      const name = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      return name && value ? `${name}: ${value}` : "";
    })
    .filter(Boolean);
}

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

i18n.apply();

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
  setStatus(i18n.t("confirm_status_processing"));
  try {
    const result = await browser.runtime.sendMessage({
      type: "confirm-download",
      id: pendingId,
      action,
      payload: {
        filename: elements.filename.value.trim(),
        referrer: elements.referrer.value.trim(),
        aria2Headers: parseHeaderLines(elements.headers.value),
      },
    });

    if (result.mode === "aria2") {
      setStatus(i18n.t("confirm_status_aria2"), "success");
    } else if (result.mode === "browser") {
      setStatus(i18n.t("confirm_status_browser"), "success");
    } else {
      setStatus(i18n.t("confirm_status_cancelled"), "success");
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
    setStatus(i18n.t("confirm_status_missing_id"), "error");
    return;
  }

  const pending = await browser.runtime.sendMessage({
    type: "get-pending",
    id: pendingId,
  });

  if (!pending) {
    setStatus(i18n.t("confirm_status_expired"), "error");
    return;
  }

  currentPending = pending;
  elements.url.value = pending.url || "";
  elements.filename.value = pending.filename || "";
  elements.referrer.value = pending.referrer || "";
  elements.headers.value = (pending.aria2Headers || []).join("\n");

  if (pending.type === "context-link") {
    elements.browser.style.display = "none";
  }
}

function restoreAutoHeaders() {
  if (!currentPending) {
    return;
  }
  elements.headers.value = (currentPending.autoAria2Headers || currentPending.aria2Headers || []).join("\n");
}

elements.aria2.addEventListener("click", () => submit("aria2"));
elements.browser.addEventListener("click", () => submit("browser"));
elements.resetHeaders.addEventListener("click", restoreAutoHeaders);
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
  setStatus(error.message || i18n.t("confirm_status_init_failed"), "error");
});
