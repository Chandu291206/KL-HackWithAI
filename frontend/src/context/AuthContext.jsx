import { createContext, useContext, useState, useEffect } from "react";
import { getMe } from "../api/user";
import { login as apiLogin, signup as apiSignup } from "../api/auth";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem("educoach_token"));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            localStorage.setItem("educoach_token", token);
            fetchUser();
        } else {
            localStorage.removeItem("educoach_token");
            setUser(null);
            setLoading(false);
        }
    }, [token]);

    const fetchUser = async () => {
        try {
            const userData = await getMe();
            setUser(userData);
        } catch (error) {
            console.error("Failed to fetch user", error);
            setToken(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        const data = await apiLogin(email, password);
        setToken(data.access_token);
        return data;
    };

    const signup = async (userData) => {
        const data = await apiSignup(userData);
        setToken(data.access_token);
        return data;
    };

    const logout = () => {
        setToken(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, signup, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
