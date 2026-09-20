const express = require("express");
const supabase = require("../config/supabase");

const router = express.Router();

/*
 * Price history for a tracked product.
 */
router.get("/:trackedProductId", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("price_history")
            .select("*")
            .eq(
                "tracked_product_id",
                req.params.trackedProductId
            )
            .order("scraped_at", {
                ascending: true,
            });

        if (error) {
            throw error;
        }

        res.json({
            count: data.length,
            history: data,
        });
    } catch (error) {
        console.error("History error:", error);

        res.status(500).json({
            error: "Unable to fetch price history",
        });
    }
});

/*
 * Scrape attempt logs.
 */
router.get(
    "/:trackedProductId/logs",
    async (req, res) => {
        try {
            const { data, error } = await supabase
                .from("scrape_logs")
                .select("*")
                .eq(
                    "tracked_product_id",
                    req.params.trackedProductId
                )
                .order("attempted_at", {
                    ascending: false,
                });

            if (error) {
                throw error;
            }

            res.json({
                count: data.length,
                logs: data,
            });
        } catch (error) {
            console.error(
                "Scrape logs error:",
                error
            );

            res.status(500).json({
                error: "Unable to fetch scrape logs",
            });
        }
    }
);

module.exports = router;