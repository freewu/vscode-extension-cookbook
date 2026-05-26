# Extension Manifest
> 每个 Visual Studio Code 扩展都需要一个package.json位于扩展目录结构根目录的清单文件

## 配置项
配置项                   |	必需  |	类型    |	描述
------------------------|-------|---------|----------------------------------------------------------------------------------------------------------------------
name	                | 是	| string  |	扩展程序名称必须全部小写，且不含空格。该名称在应用商店中必须是唯一的。
version	                | 是	| string  |	兼容语义化版本规范的版本。
publisher	            | 是	| string  |	出版商标识符
engines	                | 是	| object  |	包含至少一个与扩展程序兼容vscode的 VS Code 版本匹配的键的对象。不能为空。例如：表示与最低 VS Code 版本 兼容。*^0.10.50.10.5
license  	            | 是	| string  |	请参阅npm 的文档LICENSE。如果您的扩展程序根目录中有一个文件，则该值license应为"SEE LICENSE IN <filename>"。
displayName	            | 是	| string  |	在应用市场中使用的扩展程序的显示名称。该显示名称在应用市场中必须是唯一的。
description	            | 是	| string  |	简要描述一下您的扩展程序是什么以及它的功能。
categories	            | 是	| string[] |	您希望用于扩展程序的类别。允许的值：[Programming Languages, Snippets, Linters, Themes, Debuggers, Formatters, Keymaps, SCM Providers, Other, Extension Packs, Language Packs, Data Science, Machine Learning, Visualization, Notebooks, Education, Testing]
keywords	            | 是	| string[] |	一系列关键词，方便用户查找扩展程序。这些关键词与其他扩展程序标签一起包含在应用商店中。目前，此列表最多包含 30 个关键词。
galleryBanner	        | 是	| object  |	帮助您设置 Marketplace 标题格式，使其与您的图标相匹配。详情请见下文。
preview	                | 是	| boolean |	将扩展程序在应用商店中标记为预览版。
main	                | 是	| string  |	您的扩展程序的入口点。
browser	                | 是	| string  |	您的Web 扩展的入口点。
contributes	            | 是	| object  |	描述扩展功能贡献的对象。
activationEvents	    | 是	| string[] |	此扩展的激活事件数组。  
badges	                | 是	| array    |	已批准的徽章数组，将显示在 Marketplace 扩展页面的侧边栏中。每个徽章都是一个包含 3 个属性的对象：url徽章图像 URL、href用户点击徽章后将要访问的链接以及description。
markdown	            | 是	| string  |	控制 Marketplace 中使用的 Markdown 渲染引擎。可以是github（默认值）或standard。
qna	                    | 是	| string  |	控制Marketplace 中的问答marketplace链接。设置为true 可启用默认的 Marketplace 问答网站。设置为字符串可提供自定义问答网站的 URL。设置为 falsefalse可完全禁用问答功能。    
sponsor	                | 是	| object  |	指定用户可以赞助您的扩展程序的位置。这是一个包含单个属性的对象url，该属性链接到用户可以赞助您的扩展程序的页面。
dependencies	        | 是	| object  |	扩展程序所需的任何运行时 Node.js 依赖项。与npm 的dependencies完全相同。
devDependencies	        | 是	| object  |	您的扩展程序所需的任何 Node.js 开发依赖项。与npm 的devDependencies完全相同。
extensionPack	        | 是	| array   |	包含可一起安装的扩展程序 ID 的数组。扩展程序的 ID 始终为${publisher}.${name}。例如：vscode.csharp。
extensionDependencie    | 是	| array	  | 数组，用于指示扩展程序在远程配置中的运行位置。值可以是ui（本地运行）、workspace（远程运行）或两者兼有，顺序决定优先级。例如：[ui, workspace]表示扩展程序可以在任一位置运行，但优先在本地运行。更多详情请参见此处。
scripts	                | 是	| object  |	与npm 的scripts完全相同，但增加了 VS Code 特有的字段，例如vscode:prepublish或vscode:uninstall。
icon	                | 是	| string  |	图标的路径至少为 128x128 像素（Retina 屏幕为 256x256）。
pricing	                | 是	| string  |	扩展程序的定价信息。允许的值：Free，Trial。默认值：Free。点击此处查看更多详情。
capabilities	        | 是	| object  |	描述扩展程序在有限工作空间中的功能的对象：untrustedWorkspaces，virtualWorkspaces
