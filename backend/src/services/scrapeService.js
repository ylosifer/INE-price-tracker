const supabase = require("../config/supabase");
const { scrapeProduct } = require("../scraper/productScraper");

async function getTrackedProduct(trackedProductId) {
    const { data, error } = await supabase
        .from("tracked_products")
        .select("*")
        .eq("id", trackedProductId)
        .single();

    if (error) {
        throw error;
    }

    return data;
}

async function saveScrapeLog(
    trackedProductId,
    attempt,
    status
) {
    const { error } = await supabase
        .from("scrape_logs")
        .insert({
            tracked_product_id: trackedProductId,
            attempted_at: new Date().toISOString(),
            status,
            attempt_number: attempt.attemptNumber ?? attempt.attempt ?? 1,
            response_time_ms:
                attempt.durationMs ?? null,
            error_type:
                attempt.errorType ?? null,
            error_message:
                attempt.errorMessage ??
                attempt.error ??
                null,
        });

    if (error) {
        throw error;
    }
}

async function savePriceHistory(
    trackedProductId,
    result
) {
    if (!result.success) {
        return;
    }

    if (
        result.currentPrice == null ||
        !result.stock
    ) {
        throw new Error(
            "Successful scrape is missing price or stock"
        );
    }

    const { error } = await supabase
        .from("price_history")
        .insert({
            tracked_product_id: trackedProductId,
            original_price: result.originalPrice ?? null,
            current_price: result.currentPrice,
            stock: result.stock,
            scraped_at: new Date().toISOString(),
        });

    if (error) {
        throw error;
    }
}

async function scrapeTrackedProduct(trackedProductId) {
    const trackedProduct =
        await getTrackedProduct(trackedProductId);

    const result = await scrapeProduct(
        trackedProduct.store_product_id,
        {
            headless: true,
            maxAttempts: 3,
        }
    );

    /*
     * The scraper should expose individual attempts.
     * If it does, persist every attempt.
     */
    const attempts = Array.isArray(result.attempts)
        ? result.attempts
        : [result];

    for (let i = 0; i < attempts.length; i++) {
        const attempt = attempts[i];

        let status;

        if (attempt.success) {
            status = "success";
        } else if (i < attempts.length - 1) {
            status = "retried";
        } else {
            status = "failed";
        }

        await saveScrapeLog(
            trackedProduct.id,
            {
                ...attempt,
                attemptNumber:
                    attempt.attemptNumber ??
                    attempt.attempt ??
                    i + 1,
            },
            status
        );
    }

    /*
     * Only successful final results enter
     * price_history.
     */
    if (result.success) {
        await savePriceHistory(
            trackedProduct.id,
            result
        );
    }

    return {
        trackedProduct,
        result,
    };
}

async function scrapeAllActiveProducts() {
    const { data: products, error } = await supabase
        .from("tracked_products")
        .select("*")
        .eq("is_active", true);

    if (error) {
        throw error;
    }

    const results = [];

    for (const product of products) {
        try {
            const result =
                await scrapeTrackedProduct(product.id);

            results.push({
                trackedProductId: product.id,
                success: result.result.success,
                productName: product.product_name,
            });
        } catch (error) {
            console.error(
                `Scrape failed for ${product.product_name}:`,
                error
            );

            results.push({
                trackedProductId: product.id,
                success: false,
                productName: product.product_name,
                error: error.message,
            });
        }
    }

    return results;
}

module.exports = {
    scrapeTrackedProduct,
    scrapeAllActiveProducts,
};