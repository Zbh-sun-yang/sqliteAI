/** Query execution page with SQL editor and result table. */

import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, Button, Space, Spin, Alert, List, Typography, Input, message } from "antd";
import { PlayCircleOutlined, ReloadOutlined, DownloadOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { apiClient, smartExport } from "../../services/api";
import { QueryResult, QueryHistoryEntry, QueryInput } from "../../types/query";
import { SqlEditor } from "../../components/SqlEditor";
import { ResultTable } from "../../components/ResultTable";

const { Text } = Typography;
const { TextArea } = Input;

export const QueryExecute: React.FC = () => {
  const { databaseName } = useParams<{ databaseName: string }>();
  const [sql, setSql] = useState("SELECT * FROM ");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<QueryHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Smart export state
  const [nlPrompt, setNlPrompt] = useState("");
  const [smartExporting, setSmartExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");

  useEffect(() => {
    if (databaseName) {
      loadHistory();
    }
  }, [databaseName]);

  const loadHistory = async () => {
    if (!databaseName) return;

    setLoadingHistory(true);
    try {
      const response = await apiClient.get<QueryHistoryEntry[]>(
        `/api/v1/dbs/${databaseName}/history`
      );
      setHistory(response.data);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleExecute = async () => {
    if (!databaseName || !sql.trim()) {
      setError("Please enter a SQL query");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const input: QueryInput = { sql: sql.trim() };
      const response = await apiClient.post<QueryResult>(
        `/api/v1/dbs/${databaseName}/query`,
        input
      );
      setResult(response.data);
      // Reload history after successful query
      await loadHistory();
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.detail || err.message || "Query execution failed";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleHistoryClick = (historyItem: QueryHistoryEntry) => {
    setSql(historyItem.sqlText);
    setError(null);
    setResult(null);
  };

  const handleSmartExport = async () => {
    if (!databaseName || !nlPrompt.trim()) {
      setError("Please describe what data you want to export");
      return;
    }

    setSmartExporting(true);
    setError(null);
    try {
      await smartExport(databaseName, nlPrompt.trim(), exportFormat);
      message.success(`Smart export (${exportFormat.toUpperCase()}) completed`);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Smart export failed");
    } finally {
      setSmartExporting(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={`Execute Query - ${databaseName}`}
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleExecute}
              loading={loading}
            >
              Execute
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadHistory}
              loading={loadingHistory}
            >
              Refresh History
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <div>
            <Card title="SQL Editor" size="small">
              <SqlEditor value={sql} onChange={(val) => setSql(val || "")} height="200px" />
            </Card>
          </div>

          {error && (
            <Alert
              message="Error"
              description={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
            />
          )}

          {loading && (
            <div style={{ textAlign: "center", padding: "50px" }}>
              <Spin size="large" />
            </div>
          )}

          {result && (
            <Card title="Query Results" size="small">
              <ResultTable
                result={result}
                loading={loading}
                databaseName={databaseName}
                sql={result.sql}
              />
            </Card>
          )}

          {/* Smart Export Section */}
          {databaseName && (
            <Card title="Smart Export (NL → SQL → Export)" size="small">
              <Space direction="vertical" style={{ width: "100%" }}>
                <TextArea
                  placeholder="Describe what data to export in natural language, e.g. &quot;list all users created in the last 30 days&quot;"
                  value={nlPrompt}
                  onChange={(e) => setNlPrompt(e.target.value)}
                  rows={3}
                />
                <Space>
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    loading={smartExporting}
                    onClick={handleSmartExport}
                  >
                    Smart Export ({exportFormat.toUpperCase()})
                  </Button>
                  <Button.Group>
                    <Button
                      size="small"
                      type={exportFormat === "csv" ? "primary" : "default"}
                      onClick={() => setExportFormat("csv")}
                    >
                      CSV
                    </Button>
                    <Button
                      size="small"
                      type={exportFormat === "json" ? "primary" : "default"}
                      onClick={() => setExportFormat("json")}
                    >
                      JSON
                    </Button>
                  </Button.Group>
                </Space>
              </Space>
            </Card>
          )}
        </Space>
      </Card>

      <Card title="Query History" style={{ marginTop: 16 }}>
        {loadingHistory ? (
          <Spin />
        ) : (
          <List
            dataSource={history}
            renderItem={(item) => (
              <List.Item
                style={{
                  cursor: "pointer",
                  backgroundColor: item.success ? "transparent" : "#fff2f0",
                }}
                onClick={() => handleHistoryClick(item)}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text
                        code
                        style={{
                          maxWidth: "600px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "inline-block",
                        }}
                      >
                        {item.sqlText}
                      </Text>
                      {item.success ? (
                        <Text type="success">
                          ✓ {item.rowCount} rows in {item.executionTimeMs}ms
                        </Text>
                      ) : (
                        <Text type="danger">✗ Failed</Text>
                      )}
                    </Space>
                  }
                  description={
                    <Text type="secondary">
                      {new Date(item.executedAt).toLocaleString()}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
};
