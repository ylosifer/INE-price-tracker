require("dotenv").config();

const express = require("express");
const cors = require("cors");

const productsRouter = require("./routes/products");
const trackedProductsRouter = require("./routes/trackedProducts");
const scrapeRouter = require("./routes/scrape");
const historyRouter = require("./routes/history");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/products", productsRouter);
app.use("/api/tracked-products", trackedProductsRouter);
app.use("/api/scrape", scrapeRouter);
app.use("/api/history", historyRouter);

app.get("/", (req, res) => {
    res.json({
        message: "INE Price Tracker API",
    });
});

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});