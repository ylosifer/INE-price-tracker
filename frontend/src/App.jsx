import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import {
  searchProducts,
  getTrackedProducts,
  trackProduct,
  getHistory,
  getScrapeLogs,
  scrapeProduct,
} from "./api";

import "./App.css";

function App() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const [trackedProducts, setTrackedProducts] = useState([]);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);

  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingTracked, setLoadingTracked] = useState(true);
  const [trackingId, setTrackingId] = useState(null);
  const [scraping, setScraping] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    loadTrackedProducts();
  }, []);

  async function loadTrackedProducts() {
    try {
      setLoadingTracked(true);
      setError("");

      const data = await getTrackedProducts();

      setTrackedProducts(data.products || []);
    } catch (err) {
      console.error(err);
      setError("Unable to load tracked products.");
    } finally {
      setLoadingTracked(false);
    }
  }

  async function handleSearch(event) {
    event.preventDefault();

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoadingSearch(true);
      setError("");

      const data = await searchProducts(query);

      setSearchResults(data.products || []);
    } catch (err) {
      console.error(err);
      setError("Unable to search products.");
    } finally {
      setLoadingSearch(false);
    }
  }

  async function handleTrack(product) {
    try {
      setTrackingId(product.id);
      setError("");

      await trackProduct(product.id);

      await loadTrackedProducts();

      setSearchResults([]);
      setQuery("");
    } catch (err) {
      console.error(err);

      const message =
        err.response?.data?.error ||
        "Unable to track this product.";

      setError(message);
    } finally {
      setTrackingId(null);
    }
  }

  async function openProduct(product) {
    try {
      setSelectedProduct(product);
      setError("");

      const [historyData, logsData] = await Promise.all([
        getHistory(product.id),
        getScrapeLogs(product.id),
      ]);

      setHistory(historyData.history || []);
      setLogs(logsData.logs || []);
    } catch (err) {
      console.error(err);
      setError("Unable to load product history.");
    }
  }

  async function handleScrape(product) {
    try {
      setScraping(true);
      setError("");

      const result = await scrapeProduct(product.id);

      if (!result.success) {
        setError(
          result.result?.error ||
            result.error ||
            "Scrape failed."
        );
      }

      await openProduct(product);

      await loadTrackedProducts();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.error ||
          "Unable to run scraper."
      );
    } finally {
      setScraping(false);
    }
  }

  function getLatestHistory() {
    if (!history.length) {
      return null;
    }

    return history[history.length - 1];
  }

  const latest = getLatestHistory();

  const chartData = history.map((item) => ({
    date: new Date(item.scraped_at).toLocaleString(),
    price: Number(item.current_price),
  }));

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>INE Price Tracker</h1>
          <p>
            Track product prices, stock and scraping reliability.
          </p>
        </div>
      </header>

      <main className="container">

        {/* SEARCH */}

        <section className="card">
          <h2>Search Products</h2>

          <form
            className="search-form"
            onSubmit={handleSearch}
          >
            <input
              type="text"
              placeholder="Search by product name, brand, category or SKU..."
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
            />

            <button type="submit">
              {loadingSearch ? "Searching..." : "Search"}
            </button>
          </form>

          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((product) => (
                <div
                  className="product-row"
                  key={product.id}
                >
                  <div>
                    <strong>{product.name}</strong>

                    <span>
                      {product.brand} · {product.category}
                    </span>

                    <small>
                      SKU: {product.sku} · ID: {product.id}
                    </small>
                  </div>

                  <button
                    onClick={() => handleTrack(product)}
                    disabled={trackingId === product.id}
                  >
                    {trackingId === product.id
                      ? "Tracking..."
                      : "Track Product"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {!loadingSearch &&
            query &&
            searchResults.length === 0 && (
              <p className="muted">
                No products found.
              </p>
            )}
        </section>

        {/* ERROR */}

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        {/* TRACKED PRODUCTS */}

        <section className="card">
          <div className="section-header">
            <div>
              <h2>Tracked Products</h2>
              <p>
                Products currently monitored by the system.
              </p>
            </div>

            <button onClick={loadTrackedProducts}>
              Refresh
            </button>
          </div>

          {loadingTracked ? (
            <p className="muted">
              Loading tracked products...
            </p>
          ) : trackedProducts.length === 0 ? (
            <p className="muted">
              No products are being tracked yet.
            </p>
          ) : (
            <div className="tracked-list">
              {trackedProducts.map((product) => (
                <div
                  className={`tracked-product ${
                    selectedProduct?.id === product.id
                      ? "selected"
                      : ""
                  }`}
                  key={product.id}
                >
                  <div>
                    <h3>{product.product_name}</h3>

                    <p>
                      Store Product ID:{" "}
                      {product.store_product_id}
                    </p>

                    <small>
                      Added{" "}
                      {new Date(
                        product.created_at
                      ).toLocaleString()}
                    </small>
                  </div>

                  <div className="product-actions">
                    <button
                      onClick={() =>
                        openProduct(product)
                      }
                    >
                      View History
                    </button>

                    <button
                      className="primary"
                      disabled={scraping}
                      onClick={() =>
                        handleScrape(product)
                      }
                    >
                      {scraping
                        ? "Scraping..."
                        : "Scrape Now"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* PRODUCT DETAILS */}

        {selectedProduct && (
          <>
            <section className="card">
              <div className="section-header">
                <div>
                  <h2>
                    {selectedProduct.product_name}
                  </h2>

                  <p>
                    Product ID:{" "}
                    {selectedProduct.store_product_id}
                  </p>
                </div>

                {latest && (
                  <div className="price-summary">
                    <strong>
                      ₹
                      {Number(
                        latest.current_price
                      ).toLocaleString("en-IN")}
                    </strong>

                    <span
                      className={
                        latest.stock === "in_stock"
                          ? "stock in"
                          : "stock out"
                      }
                    >
                      {latest.stock === "in_stock"
                        ? "In Stock"
                        : "Out of Stock"}
                    </span>
                  </div>
                )}
              </div>

              {latest && (
                <div className="stats">
                  <div>
                    <span>Original Price</span>
                    <strong>
                      ₹
                      {Number(
                        latest.original_price
                      ).toLocaleString("en-IN")}
                    </strong>
                  </div>

                  <div>
                    <span>Current Price</span>
                    <strong>
                      ₹
                      {Number(
                        latest.current_price
                      ).toLocaleString("en-IN")}
                    </strong>
                  </div>

                  <div>
                    <span>Stock</span>
                    <strong>
                      {latest.stock === "in_stock"
                        ? "Available"
                        : "Unavailable"}
                    </strong>
                  </div>

                  <div>
                    <span>Last Checked</span>
                    <strong>
                      {new Date(
                        latest.scraped_at
                      ).toLocaleString()}
                    </strong>
                  </div>
                </div>
              )}
            </section>

            {/* CHART */}

            <section className="card">
              <h2>Price History</h2>

              {chartData.length < 2 ? (
                <div className="empty-chart">
                  <p>
                    Not enough historical data for a
                    price chart yet.
                  </p>

                  <small>
                    Run another scrape later to build
                    the history.
                  </small>
                </div>
              ) : (
                <div className="chart">
                  <ResponsiveContainer
                    width="100%"
                    height={350}
                  >
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />

                      <XAxis dataKey="date" />

                      <YAxis />

                      <Tooltip
                        formatter={(value) =>
                          `₹${Number(
                            value
                          ).toLocaleString("en-IN")}`
                        }
                      />

                      <Line
                        type="monotone"
                        dataKey="price"
                        strokeWidth={3}
                        dot
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {/* SCRAPE LOG */}

            <section className="card">
              <div className="section-header">
                <div>
                  <h2>Scrape Logs</h2>
                  <p>
                    Every scraper attempt is recorded.
                  </p>
                </div>
              </div>

              {logs.length === 0 ? (
                <p className="muted">
                  No scrape attempts recorded.
                </p>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Attempt</th>
                        <th>Status</th>
                        <th>Response</th>
                        <th>Error</th>
                      </tr>
                    </thead>

                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id}>
                          <td>
                            {new Date(
                              log.attempted_at
                            ).toLocaleString()}
                          </td>

                          <td>
                            #{log.attempt_number}
                          </td>

                          <td>
                            <span
                              className={`status ${log.status}`}
                            >
                              {log.status}
                            </span>
                          </td>

                          <td>
                            {log.response_time_ms
                              ? `${log.response_time_ms} ms`
                              : "—"}
                          </td>

                          <td>
                            {log.error_message || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;