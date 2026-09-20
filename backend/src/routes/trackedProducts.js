const express = require("express");
const {
    getProductById,
} = require("../services/catalogService");
const {
    trackProduct,
    getTrackedProducts,
} = require("../services/trackedProductService");

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const products = await getTrackedProducts();

        res.json({
            count: products.length,
            products,
        });
    } catch (error) {
        console.error("Get tracked products error:", error);

        res.status(500).json({
            error: "Unable to fetch tracked products",
        });
    }
});

router.post("/", async (req, res) => {
    try {
        const { storeProductId } = req.body;

        if (!storeProductId) {
            return res.status(400).json({
                error: "storeProductId is required",
            });
        }

        // Verify that this product actually exists
        // in the INE catalog.
        const product = await getProductById(storeProductId);

        if (!product) {
            return res.status(404).json({
                error: "Product not found in INE catalog",
            });
        }

        const trackedProduct = await trackProduct(product);

        res.status(201).json({
            message: "Product tracked successfully",
            product: trackedProduct,
        });
        } catch (error) {
            console.error("Track product error:", error);

            if (error.code === "23505") {
                return res.status(409).json({
                    error: "Product is already being tracked",
                });
            }

            res.status(500).json({
                error: "Unable to track product",
                details: error.message,
                code: error.code,
            });
        }
});

module.exports = router;