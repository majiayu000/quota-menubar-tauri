# Dual Tray Spec

## 目标

在当前基线界面不变的前提下，增加 `Claude Code` 和 `Codex` 两个独立 tray 图标。

## 现状

- 前端当前只会根据 `activeTab` 计算一个百分比，并调用一次 `update_tray_icon`
- Tauri 当前只创建一个 `quota-tray`
- tray 图标当前只支持单个百分比

## 方案

1. 前端分别上报 `Claude` 和 `Codex` 的使用率，不再依赖 `activeTab`
2. Tauri 创建两个 tray：
   - `claude-tray`
   - `codex-tray`
3. 两个 tray 都复用现有左键打开窗口的行为
4. 图标继续使用当前圆环数字风格
5. 没有数据时显示中性灰色占位图标，不显示假的 `0%`

## 非目标

- 不新增 `Overview` 页
- 不修改现有弹层布局
- 不做合并 tray
