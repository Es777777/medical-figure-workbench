# OCR SVG Builder

这是一个面向医学论文机制图、graphical abstract 和科研配图重构的可运行工作台。

它现在已经不只是脚手架，而是包含一条完整的本地工作流：

1. 归一化原始图片为稳定 PNG
2. 在浏览器中做 panel 拆分和 OCR
3. 在后端做启发式区域、文本带、连接草稿分析
4. 自动把分析结果转换为可编辑 scene
5. 用 prompt planner / reconstruction planner 继续做语义结构整理
6. 在浏览器画布中继续编辑、替换医学资源并导出

## 当前能力

- 图片归一化：识别 TIFF、假扩展名 PNG 等输入，统一导出 PNG
- 浏览器导入工作台：上传论文图后拆分 panel、提取 OCR 文本、生成推荐 prompt
- 后端分析：`analyze-asset` 返回 panel / image / text / arrow 草稿节点
- 自动导入 scene：前端把后端草稿自动转成可编辑节点
- 医学资源推荐：内置元素库，并提供 `Servier Medical Art`、`Bioicons`、`CDC PHIL` 外部资源入口
- Prompt 规划：从自然语言描述中抽取实体、关系和建议动作
- 重构规划：根据当前 scene 与 prompt 对比，给出缺失节点和关系恢复建议
- 编辑器能力：图层管理、拖拽、缩放、属性编辑、替换资源、重生成 mock 变体

## 目录结构

```text
.
├─ README.md
├─ examples/
│  └─ minimal-compose-request.json
├─ python/
│  ├─ backend/
│  │  ├─ analyze_asset.py
│  │  ├─ errors.py
│  │  ├─ llm_client.py
│  │  ├─ main.py
│  │  ├─ models.py
│  │  ├─ prompt_analysis.py
│  │  ├─ reconstruction.py
│  │  └─ store.py
│  ├─ image_normalize.py
│  └─ tests/
├─ frontend/
│  ├─ package.json
│  ├─ vite.config.ts
│  └─ src/
│     ├─ api.ts
│     ├─ App.tsx
│     ├─ EditorCanvas.tsx
│     ├─ element-library.ts
│     ├─ figure-workbench.ts
│     ├─ scene-data.ts
│     └─ styles.css
└─ ts/
   ├─ api-contracts.ts
   └─ scene-graph.ts
```

## 快速开始

### 1. 启动 Python 后端

安装依赖：

```bash
python -m pip install --user --index-url https://pypi.org/simple fastapi uvicorn pillow
```

运行服务：

```bash
python -m uvicorn python.backend.main:app --reload
```

默认地址：`http://127.0.0.1:8000`

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

如需显式指定后端：

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## 浏览器工作流

1. 打开左侧 `Figure workbench`
2. 上传论文图、graphical abstract 或机制图
3. 浏览器自动完成：
   - panel 拆分
   - OCR 文本识别
   - 推荐 prompt 生成
4. 若后端可用，还会自动调用 `analyze-asset` 获取结构草稿
5. 点击 `Auto-import analyzed scene`
6. 分析结果会自动转换为画布节点：
   - `panel`
   - `image`
   - `text`
   - `arrow`
7. 再点击 `Analyze split-panel semantics`，把推荐 prompt 送入语义规划器
8. 在右侧属性面板、元素库和重构模块里继续精修

## 后端接口

已实现：

- `GET /healthz`
- `POST /normalize-asset`
- `POST /analyze-asset`
- `POST /analyze-prompt`
- `POST /reconstruct-figure`
- `POST /compose-figure`
- `POST /regenerate-node`
- `POST /export-scene`

### 接口说明

- `normalize-asset`：真实归一化实现
- `analyze-asset`：启发式区域/文本/连接草稿分析
- `analyze-prompt`：LLM 或 deterministic fallback 的语义结构规划
- `reconstruct-figure`：对比 scene 和 prompt，生成缺失结构恢复建议
- `compose-figure`：存储 scene graph
- `regenerate-node`：基于关键词返回 mock 医学资源变体
- `export-scene`：返回导出 URI

## 前端关键模块

- `frontend/src/figure-workbench.ts`
  - panel 拆分
  - OCR 动态加载
  - 推荐 prompt 生成
  - backend draft -> scene 自动转换
- `frontend/src/App.tsx`
  - 总体工作流串联
  - 导入、语义分析、重构与编辑交互
- `frontend/src/element-library.ts`
  - 内置医学元素库与关键词映射
- `frontend/src/api.ts`
  - 前端到后端接口适配与 fallback

## 验证

### Python

```bash
python -m unittest discover python/tests
```

### Frontend build

```bash
cd frontend
npm run build
```

## 已知边界

- `analyze-asset` 目前是启发式分析，不是深度学习分割模型
- 浏览器 OCR 使用 `tesseract.js`，对公式、低清图片、旋转文本仍有限制
- 箭头语义目前是基于布局规则和草稿标签推断，不是真视觉语义理解
- `regenerate-node` 仍是资源选择型 mock，不是图像生成模型
- `export-scene` 仍返回导出 URI，不生成最终排版级出版文件

## 推荐下一步

如果要继续往产品级推进，建议顺序是：

1. 接真实视觉模型替换 `analyze-asset`
2. 给 OCR 增加多语言与公式专用链路
3. 给 arrow / relation 增加更强语义分类
4. 实现真正的 SVG / PNG 导出器
5. 增加项目保存、恢复和批量处理
