# VScode UI 介绍

## 容器说明
<img src="./images/ui-guidelines/architecture-containers.png" alt="result" width="90%" />
<img src="./images/ui-guidelines/architecture-sections.png" alt="Extensions can add items to the various containers listed above." width="90%" />


## 活动栏 Activity Bar
### package.json 配置
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

默认的 Activity Bar 按钮ID：
```
explorer: Explorer view in the Side Bar
debug: Run and Debug view in the Side Bar
scm: Source Control view in the Side Bar
test: Test explorer view in the Side Bar
```

### 效果验证
<img src="./images/ui-guidelines/activity-bar.png" alt="新增活动栏 Activity Bar" width="90%" />

## 侧边栏 Sidebars 

> 主侧边栏和辅助侧边栏由一个或多个视图容器提供的视图组成

### 主侧边栏 Primary Sidebar

### 辅助侧边 Secondary Sidebar

## 面板 Panel
### package.json 配置
```json
{
    "contributes": {
        "viewsContainers": {
            "panel": [ // 在 Panel 新增一个区域
                {
                    "id": "demo2-panel",          // 视图容器指定标识符
                    "title": "Demo2 Panel",       // 视图容器指定标标题
                    "icon": "resources/icon.svg"  // 图容器指定标识符图标 大小 24x24  / 单色  / .svg 格式
                }
            ]
        },
        "views": {
            "demo2-panel": [ // 
                {
                    "id": "demo2-panel-dependencies",
                    "name": "中文看看"
                },
                {
                    "id": "demo2-panel-outline",
                    "name": "Outline"
                }
            ]
        }
    }
}
```

### 效果验证
<img src="./images/ui-guidelines/panel.png" alt="新增面板 Panel" width="90%" />


## Editor



## Status Bar


## 项目代码
> https://github.com/freewu/vscode-extension-cookbook/tree/main/code/ui-guidelines

## 资料
```
https://code.visualstudio.com/api/ux-guidelines/overview
https://code.visualstudio.com/api/references/contribution-points#contributes.viewsContainers
https://code.visualstudio.com/api/references/contribution-points#contributes.views
```