import { useEffect, useState } from "react";
import ChartModal from "../components/ChartModal";
import { useChartModal } from "../components/useChartModal";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const TIMESERIES_OPTIONS = [
  { label: "Bitcoin (BTC-USD)", value: "BTC-USD" },
  { label: "Ethereum (ETH-USD)", value: "ETH-USD" },
  { label: "Gold Futures (GC=F)", value: "GC=F" },
  { label: "Silver Futures (SI=F)", value: "SI=F" },
  { label: "HDFC Bank (HDFCBANK.NS)", value: "HDFCBANK.NS" },
  { label: "TCS (TCS.NS)", value: "TCS.NS" },
];
const MODEL_OPTIONS = [
  { label: "ARIMA", value: "arima" },
  { label: "RNN (Deep Learning)", value: "rnn" },
];

function formatPrice(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `${Number(value).toFixed(2)}%`;
}

function buildArimaChartData(arimaPayload) {
  const history = Array.isArray(arimaPayload?.history) ? arimaPayload.history : [];
  const forecast = Array.isArray(arimaPayload?.forecast) ? arimaPayload.forecast : [];
  if (!history.length || !forecast.length) return null;

  const historyPoints = history
    .map((row) => ({ date: row.date, value: Number(row.close) }))
    .filter((row) => Number.isFinite(row.value));
  const forecastPoints = forecast
    .map((row) => ({ date: row.date, value: Number(row.predicted_close) }))
    .filter((row) => Number.isFinite(row.value));

  if (!historyPoints.length || !forecastPoints.length) return null;

  const all = [...historyPoints, ...forecastPoints];
  const values = all.map((p) => p.value);
  const minY = Math.min(...values);
  const maxY = Math.max(...values);
  const spanY = maxY - minY || 1;

  const width = 980;
  const height = 420;
  const left = 65;
  const right = 25;
  const top = 30;
  const bottom = 60;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const totalPoints = all.length;
  const baseY = top + chartHeight;

  const toPxX = (idx) => left + (idx / Math.max(totalPoints - 1, 1)) * chartWidth;
  const toPxY = (val) => top + (1 - (val - minY) / spanY) * chartHeight;
  const historyPolyline = historyPoints
    .map((row, idx) => `${toPxX(idx).toFixed(2)},${toPxY(row.value).toFixed(2)}`)
    .join(" ");
  const forecastPolyline = forecastPoints
    .map((row, idx) => {
      const xIndex = historyPoints.length - 1 + idx;
      return `${toPxX(xIndex).toFixed(2)},${toPxY(row.value).toFixed(2)}`;
    })
    .join(" ");

  return {
    width,
    height,
    left,
    top,
    chartWidth,
    chartHeight,
    minY,
    maxY,
    historyPoints,
    forecastPoints,
    historyPolyline,
    forecastPolyline,
    splitX: toPxX(historyPoints.length - 1),
    baseY,
    historyAreaPoints: `${historyPolyline} ${toPxX(historyPoints.length - 1).toFixed(2)},${baseY.toFixed(2)} ${toPxX(0).toFixed(2)},${baseY.toFixed(2)}`,
  };
}

function Timeseries() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);
  const [selectedSymbol, setSelectedSymbol] = useState("BTC-USD");
  const [selectedModel, setSelectedModel] = useState("arima");
  const [forecastDays, setForecastDays] = useState(7);
  const [arimaLoading, setArimaLoading] = useState(true);
  const [arimaError, setArimaError] = useState("");
  const [arimaPayload, setArimaPayload] = useState(null);
  const { modal, close, openSvg } = useChartModal();

  useEffect(() => {
    const controller = new AbortController();

    async function fetchBitcoinData() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `${API_BASE_URL}/all-sector-stocks/timeseries/bitcoin/?period=1y&interval=1d&symbol=${encodeURIComponent(selectedSymbol)}`,
          {
          method: "GET",
          signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const result = await response.json();
        setPayload(result);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load Bitcoin data.");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchBitcoinData();
    return () => controller.abort();
  }, [selectedSymbol]);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchArimaForecast() {
      setArimaLoading(true);
      setArimaError("");
      try {
        const response = await fetch(
          `${API_BASE_URL}/all-sector-stocks/timeseries/arima/?symbol=${encodeURIComponent(selectedSymbol)}&period=1y&interval=1d&days=${forecastDays}&model=${encodeURIComponent(selectedModel)}`,
          {
            method: "GET",
            signal: controller.signal,
          },
        );

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result?.detail || `Request failed with status ${response.status}`);
        }
        setArimaPayload(result);
      } catch (err) {
        if (err.name !== "AbortError") {
          setArimaError(err.message || "Failed to load ARIMA forecast.");
          setArimaPayload(null);
        }
      } finally {
        setArimaLoading(false);
      }
    }

    fetchArimaForecast();
    return () => controller.abort();
  }, [selectedSymbol, forecastDays, selectedModel]);

  const bitcoin = payload?.data;
  const history = Array.isArray(bitcoin?.history) ? bitcoin.history.slice(-10).reverse() : [];
  const arimaChart = buildArimaChartData(arimaPayload);

  return (
    <div className="row g-4 animate-fade-in">
      <ChartModal {...modal} onClose={close} />
      <div className="col-12">
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white">
            <h4 className="mb-0">TimeSeries</h4>
          </div>
          <div className="card-body">
            <div className="row g-3 mb-3">
              <div className="col-12 col-md-6">
                <label htmlFor="timeseries-stock-select" className="form-label fw-semibold">
                  Select Stock
                </label>
                <select
                  id="timeseries-stock-select"
                  className="form-select"
                  value={selectedSymbol}
                  onChange={(e) => setSelectedSymbol(e.target.value)}
                >
                  {TIMESERIES_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-6">
                <label htmlFor="timeseries-model-select" className="form-label fw-semibold">
                  Select Model
                </label>
                <select
                  id="timeseries-model-select"
                  className="form-select"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                >
                  {MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? <p className="text-secondary mb-0">Loading Bitcoin data...</p> : null}
            {!loading && error ? <div className="alert alert-danger mb-0">{error}</div> : null}

            {!loading && !error && bitcoin ? (
              <div className="d-flex flex-column gap-3">
                <h5 className="mb-0">{bitcoin.name || "Bitcoin"} ({bitcoin.symbol || "BTC-USD"})</h5>

                <div className="table-responsive">
                  <table className="table table-striped align-middle mb-0">
                    <tbody>
                      <tr>
                        <th style={{ width: "220px" }}>Current Price</th>
                        <td>{formatPrice(bitcoin.price)} {bitcoin.currency || ""}</td>
                      </tr>
                      <tr>
                        <th>1 Year Low</th>
                        <td>{formatPrice(bitcoin.min_1y)}</td>
                      </tr>
                      <tr>
                        <th>1 Year High</th>
                        <td>{formatPrice(bitcoin.max_1y)}</td>
                      </tr>
                      <tr>
                        <th>Discount % from 1Y High</th>
                        <td>{formatPercent(bitcoin.discount_percent)}</td>
                      </tr>
                      <tr>
                        <th>Change %</th>
                        <td>{formatPercent(bitcoin.change_percent)}</td>
                      </tr>
                      <tr>
                        <th>Exchange</th>
                        <td>{bitcoin.exchange || "-"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="chart-panel p-3">
                  <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-2">
                    <h6 className="mb-0">Model Forecast</h6>
                    <div className="btn-group btn-group-sm" role="group" aria-label="Forecast days">
                      {[1, 7, 30].map((days) => (
                        <button
                          key={days}
                          type="button"
                          className={`btn ${forecastDays === days ? "btn-primary" : "btn-outline-primary"}`}
                          onClick={() => setForecastDays(days)}
                        >
                          {days} day{days > 1 ? "s" : ""}
                        </button>
                      ))}
                    </div>
                  </div>
                  {arimaLoading ? <p className="text-secondary mb-0">Generating forecast...</p> : null}
                  {!arimaLoading && arimaError ? <p className="text-danger mb-0">{arimaError}</p> : null}
                  {!arimaLoading && !arimaError && arimaChart ? (
                    <>
                      <p className="text-secondary mb-2 small">
                        Model: {selectedModel === "arima" ? "ARIMA" : "RNN (Deep Learning)"}
                        {Array.isArray(arimaPayload?.arima_order) ? ` (${arimaPayload.arima_order.join(",")})` : ""}
                        {typeof arimaPayload?.arima_order === "string" ? ` (${arimaPayload.arima_order})` : ""}
                      </p>
                      <svg
                        className="chart-svg"
                        viewBox={`0 0 ${arimaChart.width} ${arimaChart.height}`}
                        role="img"
                        aria-label="ARIMA 7 day forecast graph"
                        onClick={(e) => openSvg(e, "TimeSeries Forecast")}
                        style={{ cursor: "pointer" }}
                      >
                        <defs>
                          <linearGradient id="arimaHistoryArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--chart-line-1)" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="var(--chart-line-1)" stopOpacity="0" />
                          </linearGradient>
                          <filter id="arimaGlow" x="-30%" y="-30%" width="160%" height="160%">
                            <feGaussianBlur stdDeviation="2.6" result="blur" />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        <line
                          x1={arimaChart.left}
                          y1={arimaChart.top}
                          x2={arimaChart.left}
                          y2={arimaChart.top + arimaChart.chartHeight}
                          className="chart-axis"
                        />
                        <line
                          x1={arimaChart.left}
                          y1={arimaChart.top + arimaChart.chartHeight}
                          x2={arimaChart.left + arimaChart.chartWidth}
                          y2={arimaChart.top + arimaChart.chartHeight}
                          className="chart-axis"
                        />
                        <line
                          x1={arimaChart.splitX}
                          y1={arimaChart.top}
                          x2={arimaChart.splitX}
                          y2={arimaChart.top + arimaChart.chartHeight}
                          className="chart-grid"
                          strokeDasharray="5 5"
                        />
                        <polyline fill="url(#arimaHistoryArea)" stroke="none" points={arimaChart.historyAreaPoints} />
                        <polyline
                          fill="none"
                          stroke="var(--chart-line-1)"
                          strokeWidth="2.8"
                          filter="url(#arimaGlow)"
                          points={arimaChart.historyPolyline}
                        />
                        <polyline
                          fill="none"
                          stroke="var(--chart-line-2)"
                          strokeWidth="2.8"
                          strokeDasharray="6 6"
                          filter="url(#arimaGlow)"
                          points={arimaChart.forecastPolyline}
                        />
                        <text x={arimaChart.left} y={arimaChart.top - 8} fontSize="11" className="chart-text">
                          Close Price (Y)
                        </text>
                        <text
                          x={arimaChart.left + arimaChart.chartWidth - 125}
                          y={arimaChart.top + arimaChart.chartHeight + 35}
                          fontSize="11"
                          className="chart-text"
                        >
                          Time (X)
                        </text>
                        <text x={arimaChart.left} y={arimaChart.top + 12} fontSize="10" className="chart-text-muted">
                          Max: {formatPrice(arimaChart.maxY)}
                        </text>
                        <text
                          x={arimaChart.left}
                          y={arimaChart.top + arimaChart.chartHeight - 8}
                          fontSize="10"
                          className="chart-text-muted"
                        >
                          Min: {formatPrice(arimaChart.minY)}
                        </text>
                      </svg>
                      <div className="d-flex flex-wrap gap-3 mt-2 small text-secondary">
                        <span>
                          <span
                            style={{
                              display: "inline-block",
                              width: "10px",
                              height: "10px",
                              background: "var(--chart-line-1)",
                              marginRight: "6px",
                              borderRadius: "3px",
                            }}
                          />
                          History
                        </span>
                        <span>
                          <span
                            style={{
                              display: "inline-block",
                              width: "10px",
                              height: "10px",
                              background: "var(--chart-line-2)",
                              marginRight: "6px",
                              borderRadius: "3px",
                            }}
                          />
                          Forecast ({forecastDays} day{forecastDays > 1 ? "s" : ""})
                        </span>
                      </div>
                    </>
                  ) : null}
                </div>

                <div>
                  <h6 className="mb-2">Recent Price History (Last 10 records)</h6>
                  {history.length === 0 ? (
                    <p className="text-secondary mb-0">No history available.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered mb-0">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Open</th>
                            <th>High</th>
                            <th>Low</th>
                            <th>Close</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((row) => (
                            <tr key={row.date}>
                              <td>{row.date}</td>
                              <td>{formatPrice(row.open)}</td>
                              <td>{formatPrice(row.high)}</td>
                              <td>{formatPrice(row.low)}</td>
                              <td>{formatPrice(row.close)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Timeseries;
