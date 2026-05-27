# Contribution Points

> Contribution Points 是在 package.json 配置中 contributes 字段中进行声明

##  Copilot Chat 相关
### chatInstructions
> 为 Copilot Chat贡献指令文件。指令文件提供自定义指南，这些指南会自动包含在聊天请求中，以引导 Copilot 的行为。
> 可以使用此贡献点将可重用的指令（例如编码规范、框架特定指南或领域特定规则）与您的扩展程序捆绑在一起
```json
{
    "contributes": {
        "chatInstructions": [
            {
                "path": "./prompts/textMateGuidelines.instructions.md", // 相对于扩展根目录的 Markdown 文件路径。该路径必须指向扩展程序内部的某个位置
                "when": "resourceExtname == .tmLanguage" // 必须满足的 when 子句条件为真, 可以没有
            }
        ]
    }
}
```

### chatPromptFiles
> 为 Copilot Chat贡献提示文件。提示文件是可重用的聊天提示，用户可以在聊天中以斜杠命令的形式调用它们。您可以使用此贡献点将现成的提示文件与您的扩展程序捆绑在一起。
```json
{
    "contributes": {
        "chatPromptFiles": [
            {
                "path": "./prompts/reviewAndCreateIssue.prompt.md", // 相对于扩展根目录的 Markdown 文件路径。该路径必须指向扩展程序内部的某个位置
                "when": "resourceExtname == .tmLanguage" // 必须满足的 when 子句条件为真, 可以没有
            }
        ]
    }
}
```

### chatSkills
> 为 Copilot Chat贡献代理技能。代理技能是包含指令、脚本和资源的文件夹，Copilot 可以根据需要加载这些内容来执行特定任务。
```json
{
    "contributes": {
        "chatSkills": [
            {
                "path": "./skills/my-skill/SKILL.md", // 相对于扩展根目录的 Markdown 文件路径。该路径必须指向扩展程序内部的某个位置
                "when": "resourceExtname == .tmLanguage" // 必须满足的 when 子句条件为真, 可以没有
            }
        ]
    }
}
```
skill.md 格式:
```markdown
---
name: my-skill
description: Description of what the skill does and when to use it.
---

# My Skill

Detailed instructions for the skill...
```

## 扩展设置相关
### configuration
> 用户可以在设置编辑器中设置这些配置选项，也可以直接编辑 settings.json 文件
```json
{
    "configuration": {
      "title": "Settings Editor Test Extension",
      "type": "object",
      "properties": {
        "demo3.booleanExample": {
          "type": "boolean",
          "default": true,
          "description": "Boolean Example",
          "order": 3,
          "markdownDescription": "See the [bluefrog homepage](https://freewu.github.io/) \n\n next paragraph"
        },
        "demo3.stringExample": {
          "type": "string",
          "default": "bluefrog",
          "order": 0,
          "description": "String Example",
          "maxLength": 100,
          "minLength": 5
        },
        "demo3.numberExample": {
          "type": "number",
          "default": 100,
          "order": 1,
          "description": "Number Example",
          "minimum": 0,
          "maximum": 1000
        },
        "demo3.enumExample": {
          "type": "string",
          "enum": ["first", "second", "third"],
          "markdownEnumDescriptions": [
            "The *first* enum",
            "The *second* enum",
            "The *third* enum"
          ],
          "order": 0,
          "enumItemLabels": ["1st", "2nd", "3rd"],
          "default": "first",
          "description": "Example setting with an enum"
        },
        "demo3.arrayExample": {
          "type": "array",
          "default": [],
          "description": "Array Example"
        },
        "demo3.objetExample": {
          "type": "object",
          "default": {},
          "description": "Object Example"
        },
        "demo3.deprecatedExample": {
          "type": "string",
          "default": "Deprecated property",
          "description": "Deprecated Example",
          "markdownDeprecationMessage": "**Deprecated**: This property is deprecated. Please use the new property instead."
        },
        "demo3.patternStringExample": {
          "type": "string",
          "default": "Hello World",
          "pattern": "^[a-zA-Z0-9_]+$",
          "patternErrorMessage": "Only letters, numbers, and underscores are allowed"
        },
        "demo3.dateFormatStringExample": {
            "type": "string",
            "default": "2023-01-01",
            "format": "date",
            "description": "Date format Example"
        }
      }
    }
  }
}
```
Configuration property Schema:
```
```

### configurationDefaults
> 为其他已注册的配置贡献默认值并覆盖它们的默认值
```json
{
    "contributes": {
        "configurationDefaults": {
            "settingsEditorTestExtension.booleanExample": false,
            "settingsEditorTestExtension.stringExample": "Hello World"
        }
    }
}
```
为提供的语言贡献默认编辑器配置。例如，以下代码片段为该markdown语言贡献了默认编辑器配置：
```json
{
    "contributes": {
        "configurationDefaults": {
            "[markdown]": {
                "editor.wordWrap": "on",
                "editor.quickSuggestions": {
                    "comments": "off",
                    "strings": "off",
                    "other": "off"
                }
            }
        }
    }
}
```


## 不常用
### 认证 authentication
> 提供身份验证提供程序。这将为您的提供程序设置激活事件，并将其显示在扩展程序的功能列表中
```json
{
    "contributes": {
        "authentication": {
            "label": "Bleufrog Test",
            "id": "bluefrog"
        }
    }
}
```

### 断点 breakpoints
> 调试器扩展程序还会有一 个contributes.breakpoints 条目，其中列出了将启用设置断点的语言文件类型
```json
{
    "contributes": {
        "breakpoints": [
            {
                "language": "javascript"
            },
            {
                "language": "javascriptreact"
            }
        ]
    }
}
```

### 命令 commands
> 为命令创建用户界面，包括标题以及（可选的）图标、类别和启用状态。启用状态通过when 子句来表示。默认情况下，命令显示在命令面板（Ctrl+Shift+P）中，但也可以显示在其他菜单中。
```json
{
    "contributes": {
        "commands": [
            {
                "command": "extension.sayHello",
                "title": "Hello World",
                "category": "Hello",
                "icon": {
                    "light": "path/to/light/icon.svg",
                    "dark": "path/to/dark/icon.svg"
                }
            }
        ]
    }
}
```

### 颜色 colors
> 新增可自定义主题的颜色。这些颜色可供扩展程序在编辑器装饰器和状态栏中使用
```json
{
    "contributes": {
        "colors": [
            {
                "id": "superstatus.error",
                "description": "Color for error message in the status bar.",
                "defaults": {
                    "dark": "errorForeground",
                    "light": "errorForeground",
                    "highContrast": "#010203",
                    "highContrastLight": "#feedc3"
                }
            }
        ]
    }
}
```
扩展程序可以通过 API 使用新的和现有的主题颜色ThemeColor：
```typescript
const errorColor = new vscode.ThemeColor('superstatus.error');
```

### customEditors
> 
```json
```

### debuggers
> 
```json
```

### grammars
> 
```json
```

### icons
> 
```json
```

### iconThemes
> 
```json
```


### jsonValidation
> 
```json
```

### keybindings
> 
```json
```

### language
> 
```json
```

###  menus
> 
```json
```

### problemMatchers
> 
```json
```


### problemPatterns
> 
```json
```

### productIconThemes
> 
```json
```

### resourceLabelFormatters
> 
```json
```

### semanticTokenModifiers
> 
```json
```

### semanticTokenScopes
> 
```json
```

### semanticTokenTypes
> 
```json
```

### snippets
> 
```json
```

### submenus
> 
```json
```

### taskDefinitions
> 
```json
```


### terminal
> 
```json
```

### themes
> 
```json
```

### typescriptServerPlugins
> 
```json
```

### views
> 
```json
```

### viewsContainers
> 可以将视图容器添加到活动栏 ( activitybar) 和面板 ( panel)
```json

```

### viewsWelcome
> 
```json
```

### walkthroughs
> 
```json
```

## 资料
```
https://code.visualstudio.com/api/references/contribution-points
```     