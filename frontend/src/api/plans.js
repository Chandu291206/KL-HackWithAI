import client from "./client";

export const generatePlan = async () => {
    const response = await client.post("/api/plans/generate");
    return response.data;
};

export const getActivePlan = async () => {
    const response = await client.get("/api/plans/current");
    return response.data;
};

export const completeTask = async (day, taskIndex) => {
    const response = await client.post("/api/plans/task/complete", { day, task_index: taskIndex });
    return response.data;
};

export const checkLLMHealth = async () => {
    try {
        const response = await client.get("/api/plans/health");
        return response.data;
    } catch (err) {
        return { status: "error", llm: "offline", detail: err.message };
    }
};
