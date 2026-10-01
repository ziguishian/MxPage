# 仓库介绍与检索信息维护

更新日期：2026-10-01。本文面向维护者，记录仓库 SEO 与生成式搜索可读性（GEO）的维护方式。

## 产品定位

- 中文：MxPage · 开源 AI 电商详情页生成器。
- 英文：MxPage — Open-source AI E-commerce Product Image & Detail Page Generator。
- 核心受众：电商运营、跨境卖家、设计师、内容创作者和自部署团队。
- 首要任务：从商品参考图生成主图与详情图片，再完成编辑、翻译和导出。
- 首页入口：下载、实际案例、快速开始、FAQ；技术与架构信息放在后面。

## GitHub About

简介：

> 开源 AI 电商详情页生成器｜商品主图、详情长图、小红书图文、批量生图与多语言翻译。支持 Windows 桌面端和自部署，使用自己的模型 API。Open-source AI e-commerce product image & detail page generator.

网站入口指向 [最新 Release](https://github.com/ziguishian/MxPage/releases/latest)，使新访客能直接找到安装包。

主题只选择当前真实功能与技术栈，不添加未实现的平台、热门模型或无关产品名称。优先覆盖电商、商品图片、图片生成与编辑、小红书、批量处理、翻译、自部署和兼容 API。

本次已设置 15 个主题：`e-commerce`、`product-photography`、`product-images`、`product-detail-page`、`image-generation`、`image-editing`、`xiaohongshu`、`batch-processing`、`image-translation`、`openai-compatible`、`ai-agents`、`self-hosted`、`electron`、`nextjs`、`typescript`。

## 文档一致性

1. [README.md](../README.md) 是完整中文说明；[README.en.md](../README.en.md) 同步关键产品事实；[README.zh-CN.md](../README.zh-CN.md) 保留为中文入口。
2. [llms.txt](../llms.txt) 是可直接阅读的事实摘要和文档索引。它不是搜索收录要求，也不保证 AI 系统读取或引用；关键内容同时写在公开 README 中。
3. 每次发布同步检查版本、系统支持、张数上限、安装文件、模型前提、费用和数据流向。
4. 案例应标明输入背景、输出数量、来源与验收范围；单图提示词预览不能写成应用完成的整套成果。
5. 描述功能时区分图片生产与店铺发布、本地应用与离线模型，避免新用户误解。

## 观察效果

在 GitHub Insights → Traffic 中人工记录更新日期附近的访问量、独立访客、克隆数、来源和热门内容，隔一段时间与同长度窗口比较。结合 Release 下载量和新用户 Issues 判断介绍是否帮助用户开始使用。不要将 Star 数或短期波动直接等同于搜索排名提升。

可人工检查品牌词「MxPage」与自然需求词「开源 AI 电商详情页生成器」「AI e-commerce product image generator」的搜索结果，以及 AI 回答是否正确提及下载方式、费用和支持范围。记录查询、日期和引用 URL；检索结果随系统、地区与时间变化。

## 依据与边界

[GitHub Topics 文档](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics)说明，相关主题有助于用户按用途发现项目。

[Google AI 搜索说明](https://developers.google.com/search/docs/appearance/ai-features)强调可访问的文本、内部链接和有用内容；AI 搜索不要求额外的 AI 文件或特殊结构化标记，收录与展示也不作保证。因此仓库优化以清晰介绍、真实案例、常见问题和可维护的产品事实为主。

GitHub 托管页面的索引控制、HTML 元信息和抓取策略由平台管理。仓库内添加 meta、JSON-LD、robots.txt 或 sitemap 文件，不等于这些设置已应用到 GitHub 仓库网页。若未来发布独立官网，应再在实际站点中配置与验证。
