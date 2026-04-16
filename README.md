# Aria2 Downloader Bridge

一个面向 Firefox 的 WebExtension，用于把浏览器里的下载请求发送到 aria2。

## 已实现

- 自动监听浏览器下载，弹窗确认是否改用 aria2
- 右键链接菜单: `用 aria2 下载该链接`
- 尝试附带 Cookie、Referer、Origin、User-Agent、Authorization 等关键信息
- 内置 aria2 RPC 配置页，默认填入给定服务器

## 使用

1. 打开 Firefox，访问 `about:debugging#/runtime/this-firefox`
2. 选择“临时载入附加组件”
3. 选中当前目录下的 `manifest.json`
4. 点击工具栏按钮进入设置页，确认 aria2 连接配置

## 说明

插件会尽量转发浏览器环境中的登录态信息，但以下情况仍可能失败：

- 下载链接依赖服务端校验出口 IP
- 下载链接包含极短时效签名，发送到 aria2 时已过期
- 网站依赖浏览器特有请求流程、挑战验证码或额外 TLS 指纹
