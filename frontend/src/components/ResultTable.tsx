/** Query result table component with pagination and export. */

import React, { useState } from "react";
import { Table, Tag, Space, Button, message } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { QueryResult } from "../types/query";
import { exportQuery } from "../services/api";

interface ResultTableProps {
  result: QueryResult | null;
  loading?: boolean;
  databaseName?: string;
  sql?: string;
}

export const ResultTable: React.FC<ResultTableProps> = ({
  result,
  loading = false,
  databaseName,
  sql,
}) => {
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
  });
  const [exporting, setExporting] = useState<string | null>(null);

  if (!result) {
    return null;
  }

  const handleExport = async (format: "csv" | "json") => {
    if (!databaseName || !result.sql) {
      message.warning("Missing database or SQL information for export");
      return;
    }
    setExporting(format);
    try {
      await exportQuery(databaseName, result.sql, format);
      message.success(`${format.toUpperCase()} export started`);
    } catch (err: any) {
      message.error(err.response?.data?.detail || "Export failed");
    } finally {
      setExporting(null);
    }
  };

  const columns = result.columns.map((col) => ({
    title: col.name,
    dataIndex: col.name,
    key: col.name,
    render: (value: any) => {
      if (value === null || value === undefined) {
        return <Tag color="default">NULL</Tag>;
      }
      if (typeof value === "boolean") {
        return value ? "✓" : "✗";
      }
      if (value instanceof Date) {
        return value.toLocaleString();
      }
      return String(value);
    },
  }));

  const handleTableChange = (newPagination: any) => {
    setPagination({
      current: newPagination.current,
      pageSize: newPagination.pageSize,
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Space>
          <Tag color="blue">Rows: {result.rowCount}</Tag>
          <Tag color="green">Execution Time: {result.executionTimeMs}ms</Tag>
        </Space>
        <Space>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            loading={exporting === "csv"}
            disabled={result.rowCount === 0}
            onClick={() => handleExport("csv")}
          >
            Export CSV
          </Button>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            loading={exporting === "json"}
            disabled={result.rowCount === 0}
            onClick={() => handleExport("json")}
          >
            Export JSON
          </Button>
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={result.rows.map((row, index) => ({
          ...row,
          key: index,
        }))}
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: result.rowCount,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} rows`,
          pageSizeOptions: ["10", "50", "100", "500"],
        }}
        onChange={handleTableChange}
        scroll={{ x: "max-content" }}
      />
    </div>
  );
};
