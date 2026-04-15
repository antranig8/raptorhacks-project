import supabase from "@utils/supabase";

const rawApiBaseUrl = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const API_BASE_URL = rawApiBaseUrl.endsWith("/api/v1/private")
    ? rawApiBaseUrl
    : `${rawApiBaseUrl}/api/v1/private`;

async function getAccessToken() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new Error("No authenticated session found.");
    }

    return session.access_token;
}

async function requestVisualPython(path, options = {}) {
    const accessToken = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            ...(options.headers || {}),
        },
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.detail || "Visual Python request failed.");
    }

    return response.json();
}

export function simulateProjectile({ setup, updateCode }) {
    return requestVisualPython("/visual-python/projectile", {
        method: "POST",
        body: JSON.stringify({
            setup,
            update_code: updateCode,
        }),
    });
}

export function renderCanvas({ code }) {
    return requestVisualPython("/visual-python/canvas", {
        method: "POST",
        body: JSON.stringify({
            code,
        }),
    });
}

export function explainVisualPythonCode({ lab = "projectile", updateCode }) {
    return requestVisualPython("/visual-python/explain", {
        method: "POST",
        body: JSON.stringify({
            lab,
            update_code: updateCode,
        }),
    });
}
