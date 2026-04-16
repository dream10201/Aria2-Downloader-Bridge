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
};

const status = document.getElementById("status");
const form = document.getElementById("form");

function setStatus(message) {
  status.textContent = message;
}

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
  };

  await browser.runtime.sendMessage({
    type: "save-config",
    payload,
  });

  setStatus("设置已保存。");
});

loadConfig()
  .then(() => setStatus("已加载当前设置。"))
  .catch((error) => setStatus(error.message || "设置读取失败"));
