const fields = {
  enabled: document.getElementById("enabled"),
  autoPrompt: document.getElementById("autoPrompt"),
  rpcProtocol: document.getElementById("rpcProtocol"),
  rpcHost: document.getElementById("rpcHost"),
  rpcPort: document.getElementById("rpcPort"),
  rpcPath: document.getElementById("rpcPath"),
  rpcSecret: document.getElementById("rpcSecret"),
  downloadDir: document.getElementById("downloadDir"),
  userAgentMode: document.getElementById("userAgentMode"),
  basicHeadersOnly: document.getElementById("basicHeadersOnly"),
  extraHeaderNames: document.getElementById("extraHeaderNames"),
};

const status = document.getElementById("status");
const form = document.getElementById("form");
const i18n = window.appI18n;

function setStatus(message) {
  status.textContent = message;
}

i18n.apply();

async function loadConfig() {
  const config = await browser.runtime.sendMessage({ type: "get-config" });
  fields.enabled.checked = Boolean(config.enabled);
  fields.autoPrompt.checked = Boolean(config.autoPrompt);
  fields.rpcProtocol.value = config.rpcProtocol;
  fields.rpcHost.value = config.rpcHost;
  fields.rpcPort.value = config.rpcPort;
  fields.rpcPath.value = config.rpcPath;
  fields.rpcSecret.value = config.rpcSecret;
  fields.downloadDir.value = config.downloadDir;
  fields.userAgentMode.value = config.userAgentMode;
  fields.basicHeadersOnly.checked = Boolean(config.basicHeadersOnly);
  fields.extraHeaderNames.value = config.extraHeaderNames || "";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    enabled: fields.enabled.checked,
    autoPrompt: fields.autoPrompt.checked,
    rpcProtocol: fields.rpcProtocol.value,
    rpcHost: fields.rpcHost.value.trim(),
    rpcPort: Number(fields.rpcPort.value),
    rpcPath: fields.rpcPath.value.trim(),
    rpcSecret: fields.rpcSecret.value,
    downloadDir: fields.downloadDir.value.trim(),
    userAgentMode: fields.userAgentMode.value,
    basicHeadersOnly: fields.basicHeadersOnly.checked,
    extraHeaderNames: fields.extraHeaderNames.value.trim(),
  };

  await browser.runtime.sendMessage({
    type: "save-config",
    payload,
  });

  setStatus(i18n.t("options_status_saved"));
});

loadConfig()
  .then(() => setStatus(i18n.t("options_status_loaded")))
  .catch((error) => setStatus(error.message || i18n.t("options_status_load_failed")));
