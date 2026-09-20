import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export const searchProducts = async (query) => {
  const response = await api.get("/products/search", {
    params: { q: query },
  });

  return response.data;
};

export const getTrackedProducts = async () => {
  const response = await api.get("/tracked-products");
  return response.data;
};

export const trackProduct = async (storeProductId) => {
  const response = await api.post("/tracked-products", {
    storeProductId,
  });

  return response.data;
};

export const getHistory = async (trackedProductId) => {
  const response = await api.get(`/history/${trackedProductId}`);
  return response.data;
};

export const getScrapeLogs = async (trackedProductId) => {
  const response = await api.get(`/history/${trackedProductId}/logs`);
  return response.data;
};

export const scrapeProduct = async (trackedProductId) => {
  const response = await api.post(`/scrape/product/${trackedProductId}`);
  return response.data;
};

export default api;