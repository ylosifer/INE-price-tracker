const express = require("express");

const {
    scrapeTrackedProduct,
    scrapeAllActiveProducts,
} = require("../services/scrapeService");

const router = express.Router();

router.post("/product/:id", async (req, res) => {
    try {
        const result = await scrapeTrackedProduct(req.params.id);

        res.json({
            message: "Scrape completed",
            success: result.result.success,
            result: result.result,
        });
    } catch (error) {
        console.error("Manual scrape error:", error);

        res.status(500).json({
            error: "Scrape failed",
            details: error.message,
        });
    }
});

router.post("/all", async (req, res) => {
    try {
        const cronSecret = req.headers["x-cron-secret"];

        if (
            !process.env.CRON_SECRET ||
            cronSecret !== process.env.CRON_SECRET
        ) {
            return res.status(401).json({
                error: "Unauthorized",
            });
        }

        const results = await scrapeAllActiveProducts();

        res.json({
            message: "Scrape cycle completed",
            results,
        });
    } catch (error) {
        console.error("Scheduled scrape error:", error);

        res.status(500).json({
            error: "Scrape cycle failed",
            details: error.message,
        });
    }
});

module.exports = router;