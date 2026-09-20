const supabase = require("../config/supabase");

async function trackProduct(product) {
    const { data, error } = await supabase
        .from("tracked_products")
        .insert({
            store_product_id: product.id,
            product_name: product.name,
            product_url: `https://demo.inelabteamdev.com/product/${product.id}`,
        })
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
}

async function getTrackedProducts() {
    const { data, error } = await supabase
        .from("tracked_products")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        throw error;
    }

    return data;
}

module.exports = {
    trackProduct,
    getTrackedProducts,
};