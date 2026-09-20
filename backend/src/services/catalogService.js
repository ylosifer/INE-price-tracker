const CATALOG_URL = "https://demo.inelabteamdev.com/api/catalog";

const MAX_PAGES = 50;
const PAGE_SIZE = 20;

let catalogCache = null;
let cacheTimestamp = 0;

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCatalogPage(page, retries = 3) {
    const url = `${CATALOG_URL}?page=${page}&pageSize=${PAGE_SIZE}`;

    let lastError;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(
                    `Catalog request failed: ${response.status} ${response.statusText}`
                );
            }

            return await response.json();
        } catch (error) {
            lastError = error;

            console.warn(
                `Catalog page ${page} failed ` +
                `(attempt ${attempt}/${retries}): ${error.message}`
            );

            if (attempt < retries) {
                await sleep(500 * attempt);
            }
        }
    }

    throw lastError;
}

async function loadCatalog() {
    const now = Date.now();

    if (
        catalogCache &&
        now - cacheTimestamp < CACHE_TTL
    ) {
        return catalogCache;
    }

    const products = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
        try {
            const data = await fetchCatalogPage(page);

                if (Array.isArray(data.items)) {
                    products.push(...data.items);
                }
        } catch (error) {
            console.error(
                `Skipping catalog page ${page}: ${error.message}`
            );
        }
    }

    if (products.length === 0) {
        throw new Error("Unable to load any products from the catalog");
    }

    catalogCache = products;
    cacheTimestamp = now;

    console.log(
        `Catalog loaded: ${products.length} products`
    );

    return products;
}

async function getProductById(productId) {
    const catalog = await loadCatalog();

    return catalog.find(
        (product) => product.id === Number(productId)
    ) || null;
}

async function searchProducts(query) {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
        return [];
    }

    const catalog = await loadCatalog();

    const matches = catalog.filter((product) => {
        const name = (product.name || "").toLowerCase();
        const brand = (product.brand || "").toLowerCase();
        const category = (product.category || "").toLowerCase();
        const sku = (product.sku || "").toLowerCase();

        return (
            name.includes(normalizedQuery) ||
            brand.includes(normalizedQuery) ||
            category.includes(normalizedQuery) ||
            sku.includes(normalizedQuery)
        );
    });

    // Remove duplicate products using the store product ID.
    const uniqueProducts = Array.from(
        new Map(
            matches.map((product) => [product.id, product])
        ).values()
    );

    return uniqueProducts;
}
module.exports = {
    searchProducts,
    getProductById,
};