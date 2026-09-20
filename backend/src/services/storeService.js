const { request } = require("playwright");

const STORE_BASE_URL = "https://demo.inelabteamdev.com";

async function getCatalog(page = 1, pageSize = 20) {
    const context = await request.newContext();

    try {
        const response = await context.get(
            `${STORE_BASE_URL}/api/catalog?page=${page}&pageSize=${pageSize}`,
            {
                timeout: 30000
            }
        );

        if (!response.ok()) {
            throw new Error(
                `Catalog request failed with status ${response.status()}`
            );
        }

        return await response.json();
    } finally {
        await context.dispose();
    }
}

async function searchProducts(query) {
    const data = await getCatalog(1, 100);

    const products = data.products || [];

    const normalizedQuery = query.trim().toLowerCase();

    return products.filter((product) => {
        return (
            product.name?.toLowerCase().includes(normalizedQuery) ||
            product.brand?.toLowerCase().includes(normalizedQuery) ||
            product.category?.toLowerCase().includes(normalizedQuery) ||
            product.sku?.toLowerCase().includes(normalizedQuery)
        );
    });
}

module.exports = {
    getCatalog,
    searchProducts
};