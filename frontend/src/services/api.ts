import axios from "axios";
import { auth, isDevMode } from "../config/firebase";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL + "/api",
});

api.interceptors.request.use(async (config) => {
  if (isDevMode) {
    config.headers.Authorization = "Bearer dev-token";
    return config;
  }
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
