/** Axios API client instance. */

import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle common errors
    if (error.response) {
      const message =
        error.response.data?.detail || error.response.data?.error || "An error occurred";
      console.error("API Error:", message);
    }
    return Promise.reject(error);
  }
);

/** Trigger a file download from a blob response. */
function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/** Export query results as CSV or JSON file download. */
export async function exportQuery(
  databaseName: string,
  sql: string,
  format: "csv" | "json"
): Promise<void> {
  const response = await apiClient.post(
    `/api/v1/dbs/${databaseName}/query/export`,
    { sql, format },
    { responseType: "blob" }
  );
  const disposition = response.headers["content-disposition"] || "";
  const match = disposition.match(/filename="?(.+?)"?$/);
  const filename = match ? match[1] : `export.${format}`;
  downloadBlob(response.data, filename);
}

/** One-click smart export: NL → SQL → execute → download. */
export async function smartExport(
  databaseName: string,
  prompt: string,
  format: "csv" | "json"
): Promise<void> {
  const response = await apiClient.post(
    `/api/v1/dbs/${databaseName}/query/smart-export`,
    { prompt, format },
    { responseType: "blob" }
  );
  const disposition = response.headers["content-disposition"] || "";
  const match = disposition.match(/filename="?(.+?)"?$/);
  const filename = match ? match[1] : `smart_export.${format}`;
  downloadBlob(response.data, filename);
}
