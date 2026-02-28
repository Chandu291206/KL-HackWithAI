import client from "./client";

export const getPendingSuggestions = async () => {
    const response = await client.get("/api/suggestions/pending");
    return response.data;
};

export const respondToSuggestion = async (id, action) => {
    // action must be 'accept' or 'reject'
    const response = await client.post(`/api/suggestions/${id}/${action}`);
    return response.data;
};

export const getNotifications = async () => {
    const response = await client.get("/api/notifications");
    return response.data;
};

export const readNotification = async (id) => {
    const response = await client.post(`/api/notifications/${id}/read`);
    return response.data;
};
