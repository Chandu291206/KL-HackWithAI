import client from "./client";

export const submitTest = async (testId, answers) => {
    const response = await client.post("/api/tests/submit", { test_id: testId, answers });
    return response.data;
};

export const generateTopicTest = async (topicId, count, difficulty) => {
    const response = await client.post("/api/tests/generate/topic", { topic_id: topicId, count, difficulty });
    return response.data;
};

export const generateQuickTest = async (count, subjectFilter = null) => {
    const payload = { count };
    if (subjectFilter) payload.subject_filter = subjectFilter;
    const response = await client.post("/api/tests/generate/quick", payload);
    return response.data;
};

export const generateCustomTest = async (topicIds, count, difficulty) => {
    const response = await client.post("/api/tests/generate/custom", { topic_ids: topicIds, count, difficulty });
    return response.data;
};

export const getLatestTest = async () => {
    const response = await client.get("/api/tests/latest");
    return response.data;
};

export const getTestHistory = async () => {
    const response = await client.get("/api/tests/history");
    return response.data;
};

export const generateExamTest = async () => {
    const response = await client.post("/api/tests/generate/exam");
    return response.data;
};

export const getTestSuggestion = async (testId) => {
    const response = await client.get(`/api/tests/${testId}/suggestion`);
    return response.data;
};
