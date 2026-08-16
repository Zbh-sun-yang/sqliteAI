# 数据导出功能 (Data Export Feature)

## 概述

为智能数据库查询工具添加了数据导出功能，支持将查询结果导出为 CSV 或 JSON 格式。用户可以通过界面按钮一键导出，也可以通过自然语言描述直接完成"理解意图 → 生成 SQL → 执行查询 → 导出文件"的全自动化流程。

## 功能特性

### 1. 查询结果导出

在查询结果展示区域，结果表格右上角新增了 **Export CSV** 和 **Export JSON** 按钮：

- **CSV 导出**：将查询结果渲染为 UTF-8 BOM 编码的 CSV 文件（兼容 Excel 直接打开中文不乱码）
- **JSON 导出**：将查询结果渲染为格式化 JSON 数组文件
- 按钮仅在查询结果非空时可用
- 导出时按钮显示加载状态，完成后浏览器自动下载文件

### 2. Smart Export（智能一键导出）

在查询页面新增 **Smart Export** 卡片区域，用户可以用自然语言描述想要的数据，系统自动完成：

1. **NL2SQL**：理解自然语言描述，生成对应的 SQL 查询语句
2. **执行查询**：自动执行生成的 SQL
3. **导出文件**：将结果导出为 CSV 或 JSON 并下载

用户只需输入类似以下的描述：

- "列出过去 30 天创建的所有用户"
- "按销售额排名前 10 的商品"
- "显示每个分类下的订单数量统计"

### 3. 导出格式切换

Smart Export 区域提供 CSV/JSON 格式切换按钮，选择后点击 "Smart Export" 按钮以所选格式导出。

## 技术架构

### 后端

#### 新增文件

| 文件 | 说明 |
|------|------|
| `backend/app/services/export_service.py` | 数据渲染服务：`rows_to_csv()` 和 `rows_to_json()` 函数 |
| `backend/app/services/export_handler.py` | 导出编排：执行查询 → 渲染 → 返回 (content, filename, media_type) |

#### 修改文件

| 文件 | 变更 |
|------|------|
| `backend/app/models/schemas.py` | 新增 `ExportRequest` 和 `SmartExportRequest` 请求模型 |
| `backend/app/api/v1/queries.py` | 新增两个 API 端点（见下方） |

#### API 端点

**POST `/api/v1/dbs/{name}/query/export`**

执行 SQL 查询并以指定格式导出结果。

```json
// Request
{
  "sql": "SELECT * FROM users WHERE created_at > '2024-01-01'",
  "format": "csv"    // "csv" | "json"
}

// Response: 200 with Content-Disposition: attachment; filename="db_export.csv"
```

**POST `/api/v1/dbs/{name}/query/smart-export`**

自然语言 → SQL → 执行 → 导出，一步完成。

```json
// Request
{
  "prompt": "列出过去30天创建的所有用户",
  "format": "csv"    // "csv" | "json"
}

// Response: 200 with Content-Disposition: attachment; filename="db_export.csv"
```

### 前端

#### 修改文件

| 文件 | 变更 |
|------|------|
| `frontend/src/types/query.ts` | 新增 `ExportRequest` 和 `SmartExportRequest` 类型 |
| `frontend/src/services/api.ts` | 新增 `exportQuery()` 和 `smartExport()` 函数 |
| `frontend/src/components/ResultTable.tsx` | 新增导出按钮，接收 `databaseName` 和 `sql` props |
| `frontend/src/pages/queries/execute.tsx` | 新增 Smart Export 区域，集成导出按钮 |

### 自动化脚本

`export_workflow.sh` — 命令行一键导出脚本：

```bash
# 基本用法
bash export_workflow.sh mydb "列出所有用户及其订单" csv

# 导出为 JSON
bash export_workflow.sh mydb "top 10 products by revenue" json

# 自定义 API 地址
API_BASE=http://localhost:8000 bash export_workflow.sh mydb "..." csv
```

## 用户交互方式

### 方式 1：界面按钮（手动查询后导出）

1. 在 SQL 编辑器中输入查询语句
2. 点击 **Execute** 执行查询
3. 在结果表格右上角点击 **Export CSV** 或 **Export JSON**
4. 浏览器自动下载文件

### 方式 2：Smart Export（自然语言驱动）

1. 在 **Smart Export** 区域输入自然语言描述
2. 选择导出格式（CSV/JSON）
3. 点击 **Smart Export** 按钮
4. 系统自动完成 NL2SQL → 执行 → 导出，浏览器自动下载文件

### 方式 3：命令行脚本（自动化/批处理）

```bash
bash export_workflow.sh <database> "<prompt>" [csv|json]
```

## 文件结构

```
db_query/
├── backend/
│   └── app/
│       ├── api/v1/queries.py      # 新增 export / smart-export 端点
│       ├── models/schemas.py       # 新增 ExportRequest / SmartExportRequest
│       └── services/
│           ├── export_service.py   # 新增: CSV/JSON 渲染
│           └── export_handler.py   # 新增: 导出编排
├── frontend/src/
│   ├── components/ResultTable.tsx   # 修改: 新增导出按钮
│   ├── pages/queries/execute.tsx    # 修改: 新增 Smart Export 区域
│   ├── services/api.ts              # 修改: 新增 exportQuery / smartExport
│   └── types/query.ts               # 修改: 新增导出类型
└── export_workflow.sh               # 新增: 命令行自动化脚本
```