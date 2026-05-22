# VScode UI 介绍

## 容器说明
<img src="./images/ui-guidelines/architecture-containers.png" alt="result" width="90%" />
<img src="./images/ui-guidelines/architecture-sections.png" alt="Extensions can add items to the various containers listed above." width="90%" />


## 活动栏 Activity Bar
### package.json 
```json
{
    "contributes": {
        "viewsContainers": {
            "activitybar": [ // 在 Activity Bar 新增一个按钮
                {
                    "id": "demo2",       // 视图容器指定标识符
                    "title": "Demo2 Activity Bar",    // 图容器指定标标题
                    "icon": "resources/icon.svg" // 图容器指定标识符图标 大小 24x24  / 单色  / .svg 格式
                }
            ]
        },
        "views": {
            "demo2": [ // 
                {
                    "id": "demo2-dependencies",
                    "name": "中文看看"
                },
                {
                    "id": "demo2-outline",
                    "name": "Outline"
                }
            ]
        }
    }
}
```
> https://code.visualstudio.com/api/references/contribution-points#contributes.viewsContainers

### 验证
<img src="./images/ui-guidelines/activity-bar.png" alt="result" width="90%" />



## Primary Sidebar

## Secondary Sidebar

## Editor

## Panel

## Status Bar


## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/ui-guidelines

## 资料
```
https://code.visualstudio.com/api/ux-guidelines/overview
```