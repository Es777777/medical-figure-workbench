export type Language = "en" | "zh-CN";

type CopyBundle = {
  pageTitle: string;
  eyebrow: string;
  title: string;
  lede: string;
  summary: {
    fixture: string;
    canvas: string;
    source: string;
    regenerate: string;
    language: string;
  };
  actions: {
    english: string;
    chinese: string;
    bringForward: string;
    sendBackward: string;
    regenerate: string;
    regenerating: string;
    applyVariant: string;
    applied: string;
    reload: string;
    zoomIn: string;
    zoomOut: string;
    resetZoom: string;
    replaceSelected: string;
    insertToCanvas: string;
    generateFlowLayout: string;
    uploadFigure: string;
    parseAndSplitFigure: string;
    importPanels: string;
    analyzeImportedSemantics: string;
    autoImport: string;
    importSinglePanel: string;
    previewPanel: string;
    keepPanel: string;
    ignorePanel: string;
    saveProject: string;
    loadProject: string;
    exportJson: string;
    exportPng: string;
    analyzePrompt: string;
    applyStructure: string;
    reconstructFigure: string;
    applyReconstruction: string;
    accept: string;
    reject: string;
  };
  sections: {
    layers: string;
    canvas: string;
    properties: string;
    generatedVariants: string;
    library: string;
    flowLayout: string;
    figureWorkbench: string;
    resources: string;
    promptPlanner: string;
    reconstruction: string;
  };
  labels: {
    nodes: string;
    noSelection: string;
    selected: string;
    canvasHelp: string;
    pickNode: string;
    type: string;
    x: string;
    y: string;
    width: string;
    height: string;
    zIndex: string;
    text: string;
    fontSize: string;
    color: string;
    assetUri: string;
    prompt: string;
    feedback: string;
    currentAsset: string;
    regenerateStatus: string;
    languageToggle: string;
    fallbackDetail: string;
    bootstrapError: string;
    zoom: string;
    flowInput: string;
    contextNotes: string;
    problemNotes: string;
    analysisStatus: string;
    reconstructionStatus: string;
    proposedActions: string;
    localizedIssues: string;
    detectedPanels: string;
    recommendedPrompt: string;
    sourceFigure: string;
    importWorkflow: string;
    importMode: string;
    semanticHints: string;
    recognizedText: string;
    resourceLicense: string;
    bestFor: string;
    backendDrafts: string;
    noOcrText: string;
    recommendedResources: string;
  };
  messages: {
    noRegenerateRequest: string;
    loadingVariants: string;
    liveLoaded: string;
    mockLoaded: string;
    noVariants: string;
    emptySelection: string;
    bootstrapFailure: string;
    libraryHint: string;
    flowHint: string;
    figureWorkbenchHint: string;
    quickImportHint: string;
    canvasEmptyHint: string;
    noFigureAnalysis: string;
    analyzingFigure: string;
    singlePanelDetected: string;
    importModesHint: string;
    resourcesHint: string;
    promptHint: string;
    noPromptAnalysis: string;
    noReconstruction: string;
    noActions: string;
  };
  nodeTypes: Record<"panel" | "image" | "text" | "arrow" | "group", string>;
};

export const UI_COPY: Record<Language, CopyBundle> = {
  en: {
    pageTitle: "Scientific Figure Editor",
    eyebrow: "Scientific figure composer",
    title: "Minimal Fabric editor",
    lede: "Loads the existing example SceneGraph, keeps the current backend route names, and focuses on the first useful editing loop.",
    summary: {
      fixture: "Fixture",
      canvas: "Canvas",
      source: "Source",
      regenerate: "Regenerate",
      language: "Language",
    },
    actions: {
      english: "EN",
      chinese: "中文",
      bringForward: "Bring forward",
      sendBackward: "Send backward",
      regenerate: "Regenerate image node",
      regenerating: "Regenerating...",
      applyVariant: "Apply variant",
      applied: "Applied",
      reload: "Reload",
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      resetZoom: "Fit",
      replaceSelected: "Replace selected image",
      insertToCanvas: "Insert into canvas",
      generateFlowLayout: "Generate flow layout",
      uploadFigure: "Upload figure image",
      parseAndSplitFigure: "Parse and split figure",
      importPanels: "Import split panels",
      analyzeImportedSemantics: "Analyze split-panel semantics",
      autoImport: "Auto-import analyzed scene",
      importSinglePanel: "Import only this panel",
      previewPanel: "Preview focus",
      keepPanel: "Keep",
      ignorePanel: "Ignore",
      saveProject: "Save project",
      loadProject: "Load project",
      exportJson: "Export JSON",
      exportPng: "Export PNG",
      analyzePrompt: "Analyze prompt",
      applyStructure: "Apply structure",
      reconstructFigure: "Reconstruct figure",
      applyReconstruction: "Apply reconstruction",
      accept: "Accept",
      reject: "Reject",
    },
    sections: {
      layers: "Layers",
      canvas: "Canvas",
      properties: "Properties",
      generatedVariants: "Generated variants",
      library: "Element library",
      flowLayout: "Flow layout",
      figureWorkbench: "Figure workbench",
      resources: "Medical resources",
      promptPlanner: "Prompt planner",
      reconstruction: "Reconstruction",
    },
    labels: {
      nodes: "nodes",
      noSelection: "No selection",
      selected: "Selected",
      canvasHelp: "Resize image nodes from the corners, drag to reposition, and use the properties panel for exact values.",
      pickNode: "Pick a node",
      type: "Type",
      x: "X",
      y: "Y",
      width: "Width",
      height: "Height",
      zIndex: "Z-index",
      text: "Text",
      fontSize: "Font size",
      color: "Color",
      assetUri: "Asset URI",
      prompt: "Prompt",
      feedback: "Feedback",
      currentAsset: "Current asset",
      regenerateStatus: "Regenerate status",
      languageToggle: "Language",
      fallbackDetail: "Technical detail",
      bootstrapError: "Startup issue",
      zoom: "Zoom",
      flowInput: "Flow steps",
      contextNotes: "Context notes",
      problemNotes: "Problem notes",
      analysisStatus: "Analysis status",
      reconstructionStatus: "Reconstruction status",
      proposedActions: "Proposed actions",
      localizedIssues: "Localized issues",
      detectedPanels: "Detected panels",
      recommendedPrompt: "Recommended prompt",
      sourceFigure: "Source figure",
      importWorkflow: "Import workflow",
      importMode: "Import mode",
      semanticHints: "Semantic hints",
      recognizedText: "Recognized text",
      resourceLicense: "License",
      bestFor: "Best for",
      backendDrafts: "Backend drafts",
      noOcrText: "No OCR text",
      recommendedResources: "Recommended resources",
    },
    messages: {
      noRegenerateRequest: "No regenerate request yet.",
      loadingVariants: "Submitting regenerate-node request...",
      liveLoaded: "Variants loaded from the backend regenerate-node route.",
      mockLoaded: "Backend unavailable, showing mock variants instead.",
      noVariants: "No variants returned yet.",
      emptySelection: "Select a layer or click an object on the canvas to inspect and edit it.",
      bootstrapFailure: "The editor could not load the initial fixture. Refresh to retry.",
      libraryHint: "Use a preset to replace the selected image node, or insert a new image when no image node is selected.",
      flowHint: "Enter steps separated by new lines, commas, or arrows. The editor will split them into reserved slots with connectors.",
      figureWorkbenchHint: "Upload a composite figure, split likely manuscript panels in-browser, then send the suggested prompt into semantic planning.",
      quickImportHint: "1) Upload image  2) Browser parses and splits panels  3) Auto-import the analyzed scene into the canvas.",
      canvasEmptyHint: "Start by uploading a medical figure so the browser can parse panels and prepare an editable scene.",
      noFigureAnalysis: "No imported figure analysis yet.",
      analyzingFigure: "Analyzing the uploaded figure in-browser. OCR can take a few seconds on larger images.",
      singlePanelDetected: "Only one panel was detected. This usually means the figure has no large whitespace separators, so the full image is being treated as one editable panel.",
      importModesHint: "Choose automatic detection for typical manuscript figures, or force a manual split when the source image has weak panel boundaries.",
      resourcesHint: "These external sources are useful when a medical paper figure needs licensable, citation-friendly assets instead of placeholders.",
      promptHint: "Describe the figure as a whole. The planner will extract entities, relations, and suggested elements instead of forcing one step per line.",
      noPromptAnalysis: "No structured prompt analysis yet.",
      noReconstruction: "No reconstruction proposal yet.",
      noActions: "No actionable plan yet.",
    },
    nodeTypes: {
      panel: "Panel",
      image: "Image",
      text: "Text",
      arrow: "Arrow",
      group: "Group",
    },
  },
  "zh-CN": {
    pageTitle: "科研图编辑器",
    eyebrow: "科研机制图拼装器",
    title: "最小 Fabric 编辑器",
    lede: "加载现有 SceneGraph 示例，沿用当前后端路由，并把重点放在第一条真正有用的编辑闭环上。",
    summary: {
      fixture: "示例数据",
      canvas: "画布",
      source: "来源",
      regenerate: "生成路由",
      language: "语言",
    },
    actions: {
      english: "EN",
      chinese: "中文",
      bringForward: "上移一层",
      sendBackward: "下移一层",
      regenerate: "重新生成图片节点",
      regenerating: "生成中...",
      applyVariant: "应用变体",
      applied: "已应用",
      reload: "重新加载",
      zoomIn: "放大",
      zoomOut: "缩小",
      resetZoom: "适配",
      replaceSelected: "替换当前图片",
      insertToCanvas: "插入到画布",
      generateFlowLayout: "生成流程布局",
      uploadFigure: "上传论文配图",
      parseAndSplitFigure: "解析并拆分图片",
      importPanels: "导入拆分分图",
      analyzeImportedSemantics: "分析分图语义",
      autoImport: "自动导入分析场景",
      importSinglePanel: "只导入当前分图",
      previewPanel: "预览定位",
      keepPanel: "保留",
      ignorePanel: "忽略",
      saveProject: "保存项目",
      loadProject: "加载项目",
      exportJson: "导出 JSON",
      exportPng: "导出 PNG",
      analyzePrompt: "分析 Prompt",
      applyStructure: "应用结构",
      reconstructFigure: "重构当前图",
      applyReconstruction: "应用重构",
      accept: "接受",
      reject: "拒绝",
    },
    sections: {
      layers: "图层",
      canvas: "画布",
      properties: "属性",
      generatedVariants: "生成结果",
      library: "元素库",
      flowLayout: "流程布局",
      figureWorkbench: "图像工作台",
      resources: "医学资源",
      promptPlanner: "Prompt 规划",
      reconstruction: "重构单元",
    },
    labels: {
      nodes: "个节点",
      noSelection: "未选中",
      selected: "当前选中",
      canvasHelp: "图片节点可直接拖角缩放，拖动可改位置，右侧属性面板负责精确数值。",
      pickNode: "请选择节点",
      type: "类型",
      x: "X 坐标",
      y: "Y 坐标",
      width: "宽度",
      height: "高度",
      zIndex: "层级",
      text: "文字",
      fontSize: "字号",
      color: "颜色",
      assetUri: "资源地址",
      prompt: "生成提示词",
      feedback: "反馈",
      currentAsset: "当前资源",
      regenerateStatus: "生成状态",
      languageToggle: "语言切换",
      fallbackDetail: "技术细节",
      bootstrapError: "启动问题",
      zoom: "缩放",
      flowInput: "流程步骤",
      contextNotes: "上下文说明",
      problemNotes: "问题说明",
      analysisStatus: "分析状态",
      reconstructionStatus: "重构状态",
      proposedActions: "建议动作",
      localizedIssues: "定位问题",
      detectedPanels: "检测到的分图",
      recommendedPrompt: "推荐 Prompt",
      sourceFigure: "来源图片",
      importWorkflow: "导入流程",
      importMode: "导入模式",
      semanticHints: "语义提示",
      recognizedText: "识别文本",
      resourceLicense: "许可",
      bestFor: "适用场景",
      backendDrafts: "后端草稿",
      noOcrText: "暂无 OCR 文本",
      recommendedResources: "推荐资源",
    },
    messages: {
      noRegenerateRequest: "还没有发起生成请求。",
      loadingVariants: "正在提交 regenerate-node 请求...",
      liveLoaded: "已从后端 regenerate-node 路由加载变体。",
      mockLoaded: "后端暂不可用，当前展示的是 mock 变体。",
      noVariants: "暂时还没有生成结果。",
      emptySelection: "请在左侧图层列表选择，或直接点击画布对象进行编辑。",
      bootstrapFailure: "编辑器没有成功加载初始示例，请刷新后重试。",
      libraryHint: "可以直接用预设元素替换当前图片节点；如果当前没有选中图片，也可以插入一个新的图片节点。",
      flowHint: "按换行、逗号或箭头输入流程步骤，编辑器会自动切分成占位槽位并连上箭头。",
      figureWorkbenchHint: "上传复合论文配图后，浏览器会先本地拆分可能的分图区域，再把推荐 Prompt 送入语义规划器。",
      quickImportHint: "1）上传图片  2）浏览器自动解析并拆分分图  3）自动导入分析后的场景到画布。",
      canvasEmptyHint: "先上传一张医学论文图，浏览器会自动解析分图并准备可编辑场景。",
      noFigureAnalysis: "还没有导入图像分析结果。",
      analyzingFigure: "浏览器正在解析上传图片。对于较大的图片，OCR 可能需要几秒钟。",
      singlePanelDetected: "当前只检测到 1 个分图。这通常表示原图没有明显留白分隔，因此整张图被当作一个可编辑分图处理。",
      importModesHint: "典型论文图可优先用自动识别；如果原图分图边界不明显，可直接指定手动拆分模式。",
      resourcesHint: "当论文图需要更严谨、可引用、可授权的医学素材时，可优先从这些外部资源挑选。",
      promptHint: "用自然语言描述整张图，规划器会自动抽取实体、关系和建议元素，而不是要求你逐步拆成一行一行。",
      noPromptAnalysis: "还没有结构化 Prompt 分析结果。",
      noReconstruction: "还没有重构建议。",
      noActions: "还没有可执行动作。",
    },
    nodeTypes: {
      panel: "面板",
      image: "图片",
      text: "文字",
      arrow: "箭头",
      group: "分组",
    },
  },
};
