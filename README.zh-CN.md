# MeloMD

[English](README.md) | 简体中文

MeloMD 是一个本地优先的 Markdown 编辑器，面向快速写作、实时预览、学术笔记、技术文档和多格式导出。

开发者：**X.D. Yang**。当前版本：**3.0.2**。

## 3.0 新增内容

- 双行响应式工具栏：绿色编辑工具一行，黄色/红色格式与插入工具一行。
- 新增模式切换：可在“对照模式”和单编辑框“所见即所得模式”之间切换。
- 所见即所得和预览编辑区域会跟随窗口宽度自动变大或变小，不再固定在中间窄纸面。
- 左侧每条历史记录都有操作菜单：保存、删除、复制内容、粘贴到文档、查看路径、复制路径。
- 新建 Markdown 文件时先选择保存路径和文件名，默认扩展名为 `.md`。
- 修正 macOS Dock 图标，使用透明、尺寸平衡的西瓜铅笔图标。
- Electron 冒烟测试覆盖工具栏自动换行、所见即所得模式、历史菜单、导出和响应式宽度调整。

## 功能

- 左右对照式 Markdown 编辑与实时预览。
- 单面板所见即所得 Markdown 编辑模式。
- 基于 Electron 的本地优先桌面工作流。
- 文档历史记录和全文搜索。
- 支持表格、任务列表、脚注、高亮、上标和下标。
- 使用 KaTeX 渲染 LaTeX，支持行内公式、块级公式、对齐公式和公式源码切换。
- 针对语言学常用的 `forest` LaTeX 树图提供渲染支持。
- 支持 Mermaid 图表，包括流程图和可读性更好的甘特图。
- 支持图片插入，并以内嵌 data URL 保存，方便文档迁移。
- 可导出 Markdown、纯文本、自包含 HTML、PDF 和 Word `.docx`。

## 下载

安装包和压缩包发布在 GitHub Releases 页面。

预计 3.0.2 发布文件：

- `MeloMD-3.0.2-mac-arm64.dmg`：Apple Silicon Mac 安装包。
- `MeloMD-3.0.2-mac-arm64.zip`：Apple Silicon macOS 应用压缩包。
- `MeloMD-3.0.2-mac-x64.dmg`：Intel Mac 安装包。
- `MeloMD-3.0.2-mac-x64.zip`：Intel macOS 应用压缩包。
- `MeloMD-3.0.2-win-x64.exe`：64 位 Windows 安装包。
- `MeloMD-3.0.2-win-x64.zip`：64 位 Windows 便携压缩包。

这些本地构建默认未签名，除非打包时提供了平台签名证书。

### 未签名应用说明

macOS 可能因为应用未公证而阻止打开。可以用下面任一方式处理：

1. 先把 `MeloMD 3.0.app` 移动到 `/Applications`。
2. 尝试打开一次。如果系统阻止打开，进入 **系统设置 > 隐私与安全性**，点击 **仍要打开**。
3. 也可以在终端运行下面的命令，移除 quarantine 标记：

```bash
sudo xattr -dr com.apple.quarantine "/Applications/MeloMD 3.0.app"
```

然后再从 `/Applications` 打开应用。

Windows 可能因为安装包未签名而显示 Microsoft Defender SmartScreen 提示。继续安装的方法：

1. 双击 `MeloMD-3.0.2-win-x64.exe`。
2. 如果出现 SmartScreen 提示，点击 **更多信息**。
3. 点击 **仍要运行**。
4. 按安装向导继续安装。

## 从源码运行

安装依赖：

```bash
npm install
```

启动桌面应用：

```bash
npm run dev
```

运行验证：

```bash
npm run test:smoke
npm run test:electron
```

## 构建

构建 Apple Silicon macOS 产物：

```bash
npm run dist:mac-arm64
```

构建 Intel macOS 产物：

```bash
npm run dist:mac-x64
```

构建 Windows x64 产物：

```bash
npm run dist:win-x64
```

打包输出位于 `dist/`。

## 项目结构

```text
index.html              主编辑器界面和渲染逻辑
electron/               Electron 主进程和 preload 文件
assets/                 MeloMD 品牌资源和工具栏图标
vendor/                 离线打包的浏览器依赖库
scripts/                冒烟测试和 Electron 集成检查
MDFILES/                Markdown 示例文件
```

## 导出支持

MeloMD 支持导出：

- `.md`
- `.txt`
- `.html`
- `.pdf`
- `.docx`

HTML 导出为自包含文件，会内嵌 KaTeX 和代码高亮样式。PDF 导出使用 Electron 打印管线，以尽量接近预览效果。

## 支持项目

MeloMD 是一个个人维护的开源项目。如果它对你的写作、笔记或文档整理有帮助，可以自愿支持项目后续维护。

- PayPal：[paypal.me/yxd76](https://paypal.me/yxd76)
- 支付宝：扫描下方二维码

<p>
  <img src="assets/support/alipay.jpeg" width="220" alt="支付宝收款码">
</p>

## 许可证

MeloMD 使用 MIT License 发布。详见 [LICENSE](LICENSE)。
