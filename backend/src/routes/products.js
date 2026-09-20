const express = require("express");
const { searchProducts } = require("../services/catalogService");

const router = express.Router();

router.get("/search", async (req, res) => {
    try {
        const query = req.query.q;

        if (!query || !query.trim()) {
            return res.status(400).json({
                error: "Search query is required",
            });
        }

        const products = await searchProducts(query);

        res.json({
            query: query.trim(),
            count: products.length,
            products,
        });
        } catch (error) {
            console.error("Product search error:", error);

            res.status(502).json({
                error: "Unable to search the INE product catalog",
                details: error.message,
            });
        }
});

module.exports = router;