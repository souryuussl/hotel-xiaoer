# 酒店小二 // HOTEL XIAOER

一个**静态网页**形式的酒店知识库问答数字人。学生打开网页即可打字提问，界面为黑客终端风格。

> **定位原则**：数字人不预设“酒店数字化营销”身份。它是谁、能回答什么，只由 `knowledge/` 里的知识库内容决定。当前知识库收录的是酒店数字化营销课程讲义（项目一至四）与课程标准；以后换成前台、客房、餐饮、本地旅游等资料，小二的知识范围会自动跟着变。

---

## 一、现在有什么

- 黑客终端 UI：启动自检、CRT 扫描线、荧光绿、打字机输出、ASCII/SVG 店小二头像。
- 知识库检索：浏览器端中文 BM25 + 字符二元组，取最相关的 5 段，答案带出处。
- 两种模式：
  - **离线检索**：不需要 Key，直接展示知识库原文摘录，断网也能用。
  - **在线回答**：在「配置」里填接口和 Key，由大模型基于检索结果组织答案。
- 知识库：1553 个知识块，约 68 万字，来自：
  - 项目一《认知与基础》
  - 项目二《策划与设计》
  - 项目三《创作与运营》
  - 项目四六个任务教材
  - 《酒店数字化营销》课程标准
- 已排除：思考练习、参考答案、评分要点、附录、思维导图等，避免小二直接给学生报答案。

---

## 二、本地运行

```bash
cd "D:/workspace/02-国培项目测试"
node scripts/build-kb.mjs
python -m http.server 8126
```

打开 http://127.0.0.1:8126/

> 不能直接双击 `index.html`：浏览器会拦截 `fetch` 读取 `kb.json`。必须用本地服务器或 GitHub Pages。

Windows 也可以直接双击：

- `启动本地预览.bat`：启动 8126 端口并打开页面；
- `停止本地预览.bat`：停止 8126 服务，释放内存；
- `重新构建知识库.bat`：修改 `knowledge/source` 后重新生成 `assets/kb.json`。

重新构建知识库：

```bash
node scripts/build-kb.mjs
```

输出：`assets/kb.json`。

---

## 三、配置在线模型（可选）

### 方式 A：页面里填（推荐）

1. 点右上角「配置」。
2. 选择服务商，填接口地址、模型名、API Key。
3. 点「测试连接」，成功后保存。

Key 只保存在本机浏览器的 `localStorage`，不会写进代码或仓库。

### 方式 B：本地配置文件（可选）

公开页面默认不加载本地配置文件，避免线上请求不存在的文件。若确实需要，复制 `assets/config.local.example.js` 为 `assets/config.local.js`，填写后，在 `index.html` 底部脚本区临时加一行：

```html
<script src="assets/config.local.js"></script>
```

该文件已在 `.gitignore` 中忽略，不会提交。线上公开页面建议直接用「方式 A」在页面里填 Key，不要把 Key 写进部署文件。

### 支持的服务商

| 选项 | 协议 | 默认地址 | 默认模型 |
|---|---|---|---|
| DeepSeek | OpenAI 兼容 | `https://api.deepseek.com/v1` | `deepseek-chat` |
| 通义千问 | OpenAI 兼容 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| 豆包 / 火山方舟 | OpenAI 兼容 | `https://ark.cn-beijing.volces.com/api/v3` | 填推理接入点 ID |
| Claude（Anthropic） | Anthropic Messages | `https://api.anthropic.com` | `claude-opus-5-5` |
| 自定义 | OpenAI 兼容 | 自己填 | 自己填 |

### ⚠️ 关于 Key 的安全边界

这是**纯静态页面**，没有服务端，Key 必须出现在浏览器里。它可能被查看源码、开发者工具或网络请求的人拿到。

因此：

- 只用**临时 Key**，演示结束立即在服务商后台撤销；
- 不要把 Key 提交到 GitHub；
- 不要用有余额的主账号 Key；
- 如果以后要长期公开使用，必须加一个 Serverless 代理（Cloudflare Worker / 腾讯云函数），把 Key 放到服务端。

---

## 四、更新知识库

1. 把新的 Markdown 放进 `knowledge/source/`。
2. 需要的话修改 `knowledge/manifest.json` 里的 `scope` / `exclude`。
3. 运行 `node scripts/build-kb.mjs`。
4. 提交 `knowledge/` 和 `assets/kb.json`，推送后 GitHub Actions 会自动重新构建并部署。

构建脚本会自动排除标题中含以下字样的章节：

```text
参考答案、评分要点、附录、思考练习、单项选择题、判断题、
简答题、案例分析题、知识总览、思维导图、课程基本信息、
学分及参考学时、教学实施与保障、授课进程、附录字段等
```

如果要保留或排除某类内容，改 `scripts/build-kb.mjs` 里的 `BLOCK_HEADING`。

---

## 五、部署到 GitHub Pages

仓库建议命名：`hotel-xiaoer`

1. 在 GitHub 新建**公开**仓库（公开仓库才能免费使用 Pages）。
2. 推送本目录。
3. 仓库 Settings → Pages → Source 选 **GitHub Actions**。
4. 推送 `main` 后自动部署，网址形如：

```text
https://souryuussl.github.io/hotel-xiaoer/
```

> 公开仓库意味着 `knowledge/source/` 里的课程资料也会公开。若资料有版权或隐私限制，改用私有仓库 + Cloudflare Pages（支持私有仓库），或只公开经过删减的知识库。

---

## 六、目录结构

```text
02-国培项目测试/
├─ index.html                  # 页面入口
├─ assets/
│  ├─ css/terminal.css         # 黑客终端样式
│  ├─ js/rag.js                # 中文 BM25 检索
│  ├─ js/llm.js                # 模型接口适配
│  ├─ js/app.js                # 页面交互
│  ├─ kb.json                  # 构建产物（知识块）
│  ├─ config.local.example.js  # 本地 Key 配置示例
│  └─ config.local.js          # 实际配置（gitignore）
├─ knowledge/
│  ├─ manifest.json            # 名称、范围、排除项
│  └─ source/                  # 知识库 Markdown 原文
├─ scripts/build-kb.mjs        # 切块 + 生成 kb.json
├─ .github/workflows/pages.yml # GitHub Pages 自动部署
└─ README.md
```

---

## 七、常见问题

**Q：页面一直显示“知识库加载失败”？**  
A：不要双击打开，先用 `python -m http.server 8126` 或部署到 Pages。

**Q：在线回答报 CORS 错误？**  
A：部分模型接口不允许浏览器直连。先换一个支持浏览器直连的服务；如果都不行，需要加一个临时 Serverless 代理。离线检索不受影响。

**Q：小二答不出某个问题？**  
A：说明知识库没有覆盖。把相关资料补进 `knowledge/source/`，重新构建即可；也可以调整 `manifest.json` 的 `scope`。

**Q：怎么让小二只答酒店问题，不答别的？**  
A：现在通过“检索不到就不回答”实现。系统提示词也要求只依据资料回答；以后可增加主题分类或更严格的拒答阈值。
