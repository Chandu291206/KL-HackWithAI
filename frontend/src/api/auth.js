import client from "./client";

export const signup = async (data) => {
    const response = await client.post("/api/auth/signup", data);
    return response.data;
};

export const login = async (email, password) => {
    // FastAPI OAuth2PasswordRequestForm requires form-data
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);

    const response = await client.post("/api/auth/login", formData, {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
    });
    return response.data;
};
