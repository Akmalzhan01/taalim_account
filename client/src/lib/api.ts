import axios from "axios";
import { toast } from "sonner";

export const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.message || err.message || "Неизвестная ошибка";

    // Если токен истёк — выкидываем на вход. На самой странице входа не
    // редиректим, иначе сообщение «неверный пароль» не успеет показаться.
    if (
      err.response?.status === 401 &&
      !location.pathname.startsWith("/login")
    ) {
      localStorage.removeItem("token");
      location.href = "/login";
    } else {
      toast.error(message);
    }

    return Promise.reject(err);
  }
);
