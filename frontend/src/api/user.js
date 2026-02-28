import client from "./client";

export const getMe = async () => {
    const response = await client.get("/api/user/me");
    return response.data;
};

export const getDashboard = async () => {
    const response = await client.get("/api/user/dashboard");
    return response.data;
};

export const getStreak = async () => {
    const response = await client.get("/api/user/streak");
    return response.data;
};
