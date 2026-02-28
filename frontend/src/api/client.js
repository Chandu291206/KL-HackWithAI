import axios from "axios";

const client = axios.create({
    baseURL: "",
});

client.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("educoach_token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default client;
