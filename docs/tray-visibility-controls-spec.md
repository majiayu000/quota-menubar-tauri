# Tray Visibility Controls Spec

## 目标

在双 tray 基线之上，限制 tray 的显示规则：

- 只有服务已拿到登录态时，才显示对应 tray
- 如果只有一个服务已连接，则只显示那一个
- 面板里提供 Claude 和 Codex 两个独立开关，允许单独关闭对应 tray

## 规则

`tray 可见 = 用户开关开启 && 服务已连接`

其中：

- Claude 连接态来自 `QuotaData.connected`
- Codex 连接态来自 `CodexPanel` 上报的 `connected`

## 初始化

- 两个 tray 在原生层先创建，但默认隐藏
- 前端拿到服务状态后再决定是否显示

## 非目标

- 不修改主面板的 tab 结构
- 不新增 Overview 页面
- 不更改 tray 图标样式
