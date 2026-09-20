const API_URL = "http://localhost:5000";

export async function checkBackend() {
    const response = await fetch(`${API_URL}/api/health`);

    if (!response.ok) {
        throw new Error("Backend request failed");
    }

    return response.json();
}