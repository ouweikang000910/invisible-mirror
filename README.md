# 隐形镜 Invisible Mirror

GitHub Pages 发布版本。照片在访问者的浏览器内检查和处理，不需要 API Key。

一个在浏览器内运行的照片隐私检查与遮挡工具。用户照片不上传到服务器，不需要 API Key。

## 使用

1. 导入 JPEG、PNG 或 WebP，或者加载虚构演示照片。
2. 点击「开始隐私检查」。首次会从同一站点下载本地模型，之后模型在浏览器内执行。
3. 查看人物、屏幕、OCR 文字与 GPS 元数据线索。逐项选择遮挡或忽略。
4. 用「框选遮挡」补充区域，支持纯色、马赛克和柔和模糊，可以撤销。
5. 使用分界滑块对比原图和结果，导出重新编码的 JPEG。原文件保持不变。

## 能力范围

- TensorFlow.js COCO-SSD 在本机检测人物与部分屏幕类设备。默认把最大人物区域当作主角，只提示其他人物，可以选择同时提示主角。
- Tesseract.js 本地中英文 OCR 列出可读文字。规则只辅助标注联系信息、工作资料或位置类文字，不判断保密级别。
- exifr 检查原文件 GPS。导出的 JPEG 由 Canvas 重新编码，不复制 EXIF、GPS、XMP 等原始元数据。
- 多张检查完成后，组图复核只匹配 OCR 中重复的数字或酒店类文字，不声称能够综合推断地点。
- 单张最多 25 MB，最多 10 张。编辑长边上限 4096 像素，超过 4000 万像素的照片提示缩小后再导入。
- 浏览器刷新或关闭后，照片和编辑记录清空。识别模型缓存不包含照片。

模型可能漏检或误报。镜面、窗景、品牌与工作机密的语义判断仍需本人或团队复核。没有 API，也没有预设的虚假扫描结果。

## 本地开发

Node.js 20.19+，推荐 Node.js 22/24。

```sh
npm ci
npm run prepare:models
npm run dev
```

默认地址由 Vite 在终端显示。首次开发时使用 `npm run prepare:models` 下载模型到 `public/ai/`，并对照已提交的 SHA-256 清单校验。发布后，模型与程序由同一个 GitHub Pages 站点提供，处理照片时不访问第三方识别服务。

```sh
npm test
node scripts/prepare-models.mjs --verify
npm run build
npm run preview
```

模型来源、许可证和 SHA-256 校验位于 `public/ai/README.md`、`public/ai/asset-manifest.json`。更新时运行 `node scripts/prepare-models.mjs`。第三方包使用各自许可证，演示图为本项目 AI 生成素材。

## 隐私实现

原文件仅通过 File API 读取，使用 Object URL 展示，OCR 与物体检测读取本地 Canvas。应用没有上传接口、云端识别、用户行为埋点或照片持久化。静态站点请求仅用于加载程序、示例图与模型文件。

默认的纯色遮挡会覆盖选中区域。马赛克和模糊属于可选的视觉处理，敏感文字建议使用纯色遮挡。导出前应确认所有需保护的信息均在遮挡范围内。

## GitHub Pages 部署

仓库的 Settings → Pages 选择 GitHub Actions 作为发布源。推送到 main 后，工作流会安装依赖、运行测试、准备并校验模型、构建静态网页并发布。模型下载只发生在构建期间。

仓库站点使用 `/invisible-mirror/` 基础路径。自定义域名或改名时，需要同步修改工作流中的 `VITE_BASE_PATH`。本地可用 `VITE_BASE_PATH=/invisible-mirror/ npm run build` 验证子目录构建。
