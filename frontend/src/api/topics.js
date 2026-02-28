import client from "./client";

export const getTopics = async () => {
    const response = await client.get("/api/topics");
    return response.data;
};

export const getTopicDetail = async (topicId) => {
    const response = await client.get(`/api/topics/${topicId}`);
    return response.data;
};

export const getTopicQuestions = async (topicId) => {
    const response = await client.get(`/api/topics/${topicId}/questions`);
    return response.data;
};

export const getYoutubeVideos = async (topicName) => {
    const response = await client.get(`/api/youtube/${encodeURIComponent(topicName)}`);
    return response.data;
};
