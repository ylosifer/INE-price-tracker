

const { chromium } = require("playwright");

const STORE_BASE_URL = "https://demo.inelabteamdev.com";

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(text) {
    return (text || "")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function parsePrice(text) {
    if (!text) {
        return null;
    }

    const cleaned = cleanText(text);

    const match = cleaned.match(/₹\s*([\d,]+(?:\.\d+)?)/);

    if (!match) {
        return null;
    }

    const value = Number(match[1].replace(/,/g, ""));

    return Number.isFinite(value) ? value : null;
}

/**
 * Extract the price only from the dedicated price-main element.
 *
 * This is intentional.
 * Do NOT scan the entire page for ₹ values because the page
 * contains other numeric values such as stock quantities,
 * ratings and delivery information.
 */
async function extractPrice(page) {
    try {
        const priceData = await page.evaluate(() => {
            const priceElements = Array.from(
                document.querySelectorAll(".price-main")
            );

            const visibleElements = priceElements.filter((element) => {
                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();

                return (
                    style.display !== "none" &&
                    style.visibility !== "hidden" &&
                    rect.width > 0 &&
                    rect.height > 0
                );
            });

            const values = visibleElements
                .map((element) => {
                    const text = element.innerText || element.textContent || "";

                    const cleaned = text
                        .replace(/[\u200B-\u200D\uFEFF]/g, "")
                        .trim();

                    const match = cleaned.match(
                        /₹\s*([\d,]+(?:\.\d+)?)/g
                    );

                    if (!match) {
                        return null;
                    }

                    return match.map((value) => {
                        const number = value
                            .replace(/[₹,\s]/g, "");

                        return Number(number);
                    });
                })
                .filter(Boolean)
                .flat()
                .filter(Number.isFinite);

            return {
                values,
                elements: visibleElements.map((element) => ({
                    text:
                        element.innerText ||
                        element.textContent ||
                        "",
                    className: element.className,
                })),
            };
        });

        const values = priceData.values;

        if (!values.length) {
            return {
                originalPrice: null,
                currentPrice: null,
                error: "No price found in .price-main",
            };
        }

        /*
         * The mock store can render multiple price values.
         *
         * Example:
         * ₹16,314
         * Deal price ₹15,825
         *
         * The first value is treated as original price and
         * the second as current/deal price when available.
         */
        const uniqueValues = [...new Set(values)];

        let originalPrice = null;
        let currentPrice = null;

        if (uniqueValues.length >= 2) {
            originalPrice = uniqueValues[0];
            currentPrice = uniqueValues[1];
        } else {
            currentPrice = uniqueValues[0];
        }

        return {
            originalPrice,
            currentPrice,
            error: null,
        };
    } catch (error) {
        return {
            originalPrice: null,
            currentPrice: null,
            error: error.message,
        };
    }
}

async function extractStock(page) {
    try {
        const stockData = await page.evaluate(() => {
            const selectors = [
                ".stock-badge",
                ".in-stock",
                ".out-of-stock",
            ];

            for (const selector of selectors) {
                const elements = Array.from(
                    document.querySelectorAll(selector)
                );

                for (const element of elements) {
                    const style = window.getComputedStyle(element);
                    const rect = element.getBoundingClientRect();

                    const visible =
                        style.display !== "none" &&
                        style.visibility !== "hidden" &&
                        rect.width > 0 &&
                        rect.height > 0;

                    if (!visible) {
                        continue;
                    }

                    const text =
                        element.innerText ||
                        element.textContent ||
                        "";

                    const cleaned = text
                        .replace(/[\u200B-\u200D\uFEFF]/g, "")
                        .replace(/\s+/g, " ")
                        .trim();

                    if (!cleaned) {
                        continue;
                    }

                    const lower = cleaned.toLowerCase();

                    if (
                        selector === ".out-of-stock" ||
                        lower.includes("out of stock") ||
                        lower.includes("sold out")
                    ) {
                        return {
                            stock: "out_of_stock",
                            text: cleaned,
                        };
                    }

                    if (
                        selector === ".in-stock" ||
                        lower.includes("in stock") ||
                        lower.includes("selling fast") ||
                        lower.includes("left")
                    ) {
                        return {
                            stock: "in_stock",
                            text: cleaned,
                        };
                    }
                }
            }

            /*
             * Fallback: inspect visible body text for stock phrases.
             */
            const bodyText = (
                document.body.innerText ||
                ""
            )
                .replace(/[\u200B-\u200D\uFEFF]/g, "")
                .replace(/\s+/g, " ")
                .trim();

            const lowerBody = bodyText.toLowerCase();

            if (
                lowerBody.includes("out of stock") ||
                lowerBody.includes("sold out")
            ) {
                return {
                    stock: "out_of_stock",
                    text: "OUT OF STOCK",
                };
            }

            const inStockMatch = bodyText.match(
                /in stock(?:\s*[·-]\s*\d+\s*left)?/i
            );

            if (inStockMatch) {
                return {
                    stock: "in_stock",
                    text: inStockMatch[0],
                };
            }

            const sellingFastMatch = bodyText.match(
                /selling fast\s*[—-]?\s*\d+\s*left/i
            );

            if (sellingFastMatch) {
                return {
                    stock: "in_stock",
                    text: sellingFastMatch[0],
                };
            }

            return {
                stock: null,
                text: null,
            };
        });

        return stockData;
    } catch (error) {
        return {
            stock: null,
            text: null,
            error: error.message,
        };
    }
}

/**
 * Perform the interaction required to reveal the price.
 *
 * Every wait is bounded so a broken/delayed page cannot hang
 * the scraper forever.
 */
async function performReveal(page) {
    console.log("Price area found.");

    const revealButton = page.getByRole("button", {
        name: /reveal price/i,
    });

    /*
     * Wait for the Reveal Price button to appear.
     */
    try {
        await revealButton.waitFor({
            state: "visible",
            timeout: 5000,
        });

        console.log("Reveal button found.");
    } catch (error) {
        throw new Error(
            "Reveal Price button was not visible within 5 seconds"
        );
    }

    /*
     * The INE store explicitly requires the user
     * to hover over the price area before the
     * current price can be revealed.
     */
    try {
        const priceArea = page.locator(
            ".price-area, .price-container, .price-main"
        ).first();

        await priceArea.waitFor({
            state: "visible",
            timeout: 5000,
        });

        await priceArea.scrollIntoViewIfNeeded({
            timeout: 5000,
        });

        console.log("Hovering over price area...");

        await priceArea.hover({
            force: true,
            timeout: 5000,
        });

        console.log("Price area hovered.");

        /*
         * The store performs asynchronous work after
         * the hover event, so give it some time before
         * checking the button state.
         */
        await sleep(1500);

    } catch (error) {
        console.warn(
            `Price-area hover warning: ${error.message}`
        );
    }

    /*
     * Wait for the Reveal Price button to become enabled.
     *
     * The store can respond slowly, so this is deliberately
     * bounded at 15 seconds rather than waiting forever.
     */
    console.log(
        "Waiting for reveal button to become enabled..."
    );

    try {
        await page.waitForFunction(
            () => {
                const buttons = Array.from(
                    document.querySelectorAll("button")
                );

                const button = buttons.find((btn) => {
                    const text =
                        btn.innerText ||
                        btn.textContent ||
                        "";

                    return /reveal price/i.test(text);
                });

                if (!button) {
                    return false;
                }

                return (
                    !button.disabled &&
                    button.getAttribute("aria-disabled") !== "true"
                );
            },
            {
                timeout: 15000,
                polling: 100,
            }
        );

        console.log("Reveal button enabled.");

    } catch (error) {
        /*
         * Capture the button state so a failed scrape
         * is diagnosable rather than silently failing.
         */
        let buttonState = null;

        try {
            buttonState = await revealButton.evaluate(
                (button) => ({
                    text:
                        button.innerText ||
                        button.textContent ||
                        "",
                    disabled: button.disabled,
                    ariaDisabled:
                        button.getAttribute("aria-disabled"),
                    className: button.className,
                })
            );
        } catch (stateError) {
            buttonState = {
                error: stateError.message,
            };
        }

        console.log(
            "Reveal button state:",
            buttonState
        );

        /*
         * Additional diagnostics.
         */
        console.log(
            "PAGE URL:",
            page.url()
        );

        console.log(
            "PAGE TITLE:",
            await page.title()
        );

        try {
            const bodyText =
                await page.locator("body").innerText();

            console.log(
                "VISIBLE BODY TEXT:",
                bodyText.slice(0, 5000)
            );
        } catch (bodyError) {
            console.log(
                "Could not read body text:",
                bodyError.message
            );
        }

        try {
            await page.screenshot({
                path: "scraper-debug.png",
                fullPage: true,
            });

            console.log(
                "Diagnostic screenshot saved as scraper-debug.png"
            );
        } catch (screenshotError) {
            console.log(
                "Could not capture screenshot:",
                screenshotError.message
            );
        }

        throw new Error(
            "Reveal button remained disabled after interaction"
        );
    }

    /*
     * Click the button only after it has actually
     * become enabled.
     */
    console.log("Clicking reveal price...");

    await revealButton.click({
        timeout: 5000,
    });

    console.log("Reveal price clicked.");
}

/**
 * Wait for either:
 *
 * 1. price to become visible
 * 2. challenge/session failure message
 * 3. timeout
 */
async function waitForRenderedPrice(page, timeout = 15000) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
        const state = await page.evaluate(() => {
            const bodyText = (
                document.body.innerText ||
                ""
            )
                .replace(/[\u200B-\u200D\uFEFF]/g, "")
                .replace(/\s+/g, " ")
                .trim();

            const priceElements = Array.from(
                document.querySelectorAll(".price-main")
            );

            const visiblePrice = priceElements.some(
                (element) => {
                    const style =
                        window.getComputedStyle(element);

                    const rect =
                        element.getBoundingClientRect();

                    return (
                        style.display !== "none" &&
                        style.visibility !== "hidden" &&
                        rect.width > 0 &&
                        rect.height > 0 &&
                        /₹/.test(
                            element.innerText ||
                                element.textContent ||
                                ""
                        )
                    );
                }
            );

            const failed =
                /couldn['’]?t load the price/i.test(
                    bodyText
                ) ||
                /challenge_failed/i.test(bodyText) ||
                /try again/i.test(bodyText);

            const stillHidden =
                /reveal price/i.test(bodyText) &&
                !visiblePrice;

            return {
                found: visiblePrice,
                failed,
                stillHidden,
                text: bodyText.slice(0, 1000),
            };
        });

        if (state.found) {
            return state;
        }

        if (state.failed) {
            throw new Error(
                "Store reported that the price could not be loaded"
            );
        }

        await sleep(300);
    }

    throw new Error(
        "Timed out waiting for rendered price"
    );
}

async function scrapeSingleAttempt(
    productId,
    {
        headless = true,
        attemptNumber = 1,
    } = {}
) {
    const startTime = Date.now();

    let browser = null;

    try {
        console.log(
            `\nScraping product ${productId} - attempt ${attemptNumber}`
        );

        browser = await chromium.launch({
            headless,
        });

        const context = await browser.newContext({
            viewport: {
                width: 1440,
                height: 900,
            },

            userAgent:
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                "AppleWebKit/537.36 " +
                "(KHTML, like Gecko) " +
                "Chrome/140.0.0.0 Safari/537.36",
        });

        const page = await context.newPage();

        /*
         * Network logging.
         */
        page.on("request", (request) => {
            const url = request.url();

            if (
                url.includes("/api/challenge") ||
                url.includes("/api/session") ||
                url.includes(`/api/products/${productId}/price`) ||
                url.includes(`/api/product/${productId}`) ||
                url.includes("/api/layout")
            ) {
                console.log(
                    `API REQUEST: ${request.method()} ${url}`
                );
            }
        });

        page.on("response", (response) => {
            const url = response.url();

            if (
                url.includes("/api/challenge") ||
                url.includes("/api/session") ||
                url.includes(`/api/products/${productId}/price`) ||
                url.includes(`/api/product/${productId}`) ||
                url.includes("/api/layout")
            ) {
                console.log(
                    `API RESPONSE: ${response.status()} ${url}`
                );
            }
        });

        const productUrl =
            `${STORE_BASE_URL}/product/${productId}`;

        console.log(`Opening ${productUrl}`);

        await page.goto(productUrl, {
            waitUntil: "domcontentloaded",
            timeout: 20000,
        });

        console.log("Product page loaded.");

        /*
         * Give initial client-side rendering a short window.
         */
        await page.waitForTimeout(1000);

        await page.waitForLoadState("networkidle", {
            timeout: 5000,
        }).catch(() => {
            console.log(
                "Network did not become idle within 5 seconds; continuing."
            );
        });

        await performReveal(page);

        /*
         * The response itself is encrypted/implementation-specific.
         * We intentionally wait for the rendered DOM state instead
         * of attempting to reverse-engineer the response.
         */
        const renderedState =
            await waitForRenderedPrice(page, 15000);

        console.log(
            "Rendered state:",
            renderedState
        );

        const priceData =
            await extractPrice(page);

        console.log(
            "Extracted price data:",
            priceData
        );

        if (priceData.error) {
            throw new Error(priceData.error);
        }

        if (priceData.currentPrice == null) {
            throw new Error(
                "Current price could not be extracted"
            );
        }

        const stockData =
            await extractStock(page);

        console.log(
            "Extracted stock:",
            stockData
        );

        if (!stockData.stock) {
            throw new Error(
                "Stock status could not be extracted"
            );
        }

        const durationMs =
            Date.now() - startTime;

        return {
            success: true,

            productId: Number(productId),

            originalPrice:
                priceData.originalPrice,

            currentPrice:
                priceData.currentPrice,

            stock:
                stockData.stock,

            stockText:
                stockData.text,

            attempt:
                attemptNumber,

            attemptNumber,

            durationMs,

            error: null,

            errorType: null,
        };
    } catch (error) {
        const durationMs =
            Date.now() - startTime;

        console.error(
            `Scrape attempt ${attemptNumber} failed:`,
            error.message
        );

        return {
            success: false,

            productId: Number(productId),

            originalPrice: null,
            currentPrice: null,
            stock: null,
            stockText: null,

            attempt:
                attemptNumber,

            attemptNumber,

            durationMs,

            error: error.message,

            errorMessage: error.message,

            errorType:
                error.name ||
                "scrape_error",
        };
    } finally {
        /*
         * Always close the browser, including failed attempts.
         */
        if (browser) {
            try {
                await browser.close();
            } catch (closeError) {
                console.warn(
                    "Browser close warning:",
                    closeError.message
                );
            }
        }
    }
}

async function scrapeProduct(
    productId,
    {
        headless = true,
        maxAttempts = 3,
    } = {}
) {
    const attempts = [];

    for (
        let attemptNumber = 1;
        attemptNumber <= maxAttempts;
        attemptNumber++
    ) {
        const result =
            await scrapeSingleAttempt(
                productId,
                {
                    headless,
                    attemptNumber,
                }
            );

        attempts.push(result);

        if (result.success) {
            return {
                ...result,

                success: true,

                attempts,
            };
        }

        /*
         * Don't wait after the final failed attempt.
         */
        if (
            attemptNumber <
            maxAttempts
        ) {
            const retryDelay =
                1000 * attemptNumber;

            console.log(
                `Retrying in ${retryDelay}ms...`
            );

            await sleep(retryDelay);
        }
    }

    const finalAttempt =
        attempts[attempts.length - 1];

    return {
        ...finalAttempt,

        success: false,

        attempts,

        error:
            finalAttempt?.error ||
            "All scrape attempts failed",

        errorMessage:
            finalAttempt?.errorMessage ||
            finalAttempt?.error ||
            "All scrape attempts failed",

        errorType:
            finalAttempt?.errorType ||
            "scrape_failed",
    };
}

module.exports = {
    scrapeProduct,
};