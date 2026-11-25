# 酒店小二 // HOTEL XIAOER

一个**静态网页**形式的酒店知识库问答数字人。学生打开网页即可打字提问，界面为黑客终端风格。

> **定位原则**：数字人不预设“酒店数字化营销”身份。它是谁、能回答什么，只由 `knowledge/` 里的知识库内容决定。当前分为「知识助手」和「酒店客服体验」两个模式，各自使用独立知识分区；以后换成前台、客房、餐饮、本地旅游等资料，小二的知识范围会自动跟着变。

---

## 一、现在有什么

- 黑客终端 UI：启动自检、CRT 扫描线、荧光绿、打字机输出、ASCII/SVG 店小二头像。
- 顶部两个切换按钮：**知识助手** / **酒店客服体验**；切换后使用各自的知识分区、欢迎语、快捷问题和回答风格。
- 知识库检索：浏览器端中文 BM25 + 字符二元组，取最相关的几段，答案带出处。
- 当前运行模式：默认**离线检索**，不需要 Key，直接展示知识库原文摘录。
- 右上角「配置」可添加**个人自己的**在线模型 Key；Key 只保存在该用户浏览器的 `localStorage`，仓库和线上部署不预置、也不保存任何 Key。
- 知识库：22 份资料，1787 个知识块，约 74.6 万字：
  - **知识助手**：1772 块 / 21 份，课程、微信生态规则、AI 内容合规；
  - **酒店客服体验**：15 块 / 1 份，泰安云栖度假酒店客服问答与标准话术。
- 已排除：思考练习、参考答案、评分要点、附录、目录、思维导图等，避免小二直接给学生报答案。

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

## 三、在线模型（个人自备 Key）

当前版本不预置任何 Key：

- 默认是离线检索，不调用外部接口；
- 右上角「配置」可以打开，用户选择服务商、填**自己的**接口地址、模型和 Key；
- Key 只保存在该用户浏览器的 `localStorage`，不会写进仓库或线上部署；
- `assets/config.js` 默认是离线配置，不包含 Key；GitHub Actions 也不注入任何 Key。

可选服务商：

| 选项 | 协议 | 默认地址 | 默认模型 |
|---|---|---|---|
| DeepSeek | OpenAI 兼容 | `https://api.deepseek.com/v1` | `deepseek-chat` |
| 通义千问 | OpenAI 兼容 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| 豆包 / 火山方舟 | OpenAI 兼容 | `https://ark.cn-beijing.volces.com/api/v3` | 填推理接入点 ID |
| Claude（Anthropic） | Anthropic Messages | `https://api.anthropic.com` | `claude-opus-5-5` |
| 自定义 | OpenAI 兼容 | 自己填 | 自己填 |

> ⚠️ 纯静态页面的 Key 会暴露在浏览器里，只适合临时演示；长期使用必须加一个 Serverless 代理（Cloudflare Worker / 腾讯云函数），把 Key 放到服务端。

---

## 四、更新知识库

两个模式使用两个独立分区：

| 模式 | 放哪里 | 内容 |
|---|---|---|
| 知识助手 | `knowledge/source/` | 课程讲义、微信生态规则、AI 合规 |
| 酒店客服体验 | `knowledge/service/` | 客服问答、服务政策、标准话术 |
| 酒店客服体验 · 回答模板 | `knowledge/service/templates/` | 你上传的回答模板，按模板格式写 |

更新步骤：

1. 把新的 Markdown 放进对应目录；
2. 需要的话修改该分区目录下的 `manifest.json` 的 `scope` / `exclude`；
3. 运行 `node scripts/build-kb.mjs` 或双击 `重新构建知识库.bat`；
4. 提交 `knowledge/` 和 `assets/kb.json`，推送后 GitHub Actions 自动部署。

客服回答模板的格式见：

```text
knowledge/service/templates/README.md
```

要点：文件名就是模板名；用 `> 关键词：入住, 几点, 房卡` 帮助检索；正文写 `## 标准回答`、`## 追问`、`## 转人工`。构建时会自动跳过 `README.md` 和以 `_` 开头的说明文件。

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

> 公开仓库意味着 `knowledge/` 里的课程资料和客服资料也会公开。若资料有版权或隐私限制，改用私有仓库 + Cloudflare Pages（支持私有仓库），或只公开经过删减的知识库。

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
│  ├─ config.js                # 默认运行时配置（离线）
│  ├─ config.local.example.js  # 本地 Key 配置示例
│  └─ config.local.js          # 实际配置（gitignore）
├─ knowledge/
│  ├─ manifest.json            # 知识助手：名称、范围、排除项
│  ├─ source/                  # 知识助手 Markdown 原文
│  └─ service/
│     ├─ manifest.json         # 酒店客服体验：范围、排除项、兜底话术
│     ├─ 营销助手知识库·酒店客服问答（泰安云栖度假酒店）.md
│     └─ templates/            # 客服回答模板（上传到这里）
│        └─ README.md          # 模板格式说明，不会被检索
├─ scripts/build-kb.mjs        # 双分区切块 + 生成 kb.json
├─ .github/workflows/pages.yml # GitHub Pages 自动部署
└─ README.md
```

---

## 七、常见问题

**Q：页面一直显示“知识库加载失败”？**  
A：不要双击打开，先用 `python -m http.server 8126` 或部署到 Pages。

**Q：在线回答报 CORS 错误？**  
A：部分模型接口不允许浏览器直连。先换一个支持浏览器直连的服务；如果都不行，需要加一个临时 Serverless 代理。离线检索不受影响。

**Q：酒店客服的回答模板放哪里？**  
A：放到 `knowledge/service/templates/`，按 `README.md` 的格式写；重新构建后，模板只进入「酒店客服体验」分区，不会混进「知识助手」。

**Q：小二答不出某个问题？**  
A：说明知识库没有覆盖。把相关资料补进 `knowledge/source/`，重新构建即可；也可以调整 `manifest.json` 的 `scope`。

**Q：怎么让小二只答酒店问题，不答别的？**  
A：现在通过“检索不到就不回答”实现。系统提示词也要求只依据资料回答；以后可增加主题分类或更严格的拒答阈值。
