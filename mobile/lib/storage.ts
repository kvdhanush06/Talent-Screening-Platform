import * as SecureStore from "expo-secure-store";

const KEYS = {
  TOKEN: "auth_token",
  USER: "user_data",
  REMEMBER_EMAIL: "remember_email",
} as const;

export const storage = {
  async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEYS.TOKEN);
    } catch {
      return null;
    }
  },

  async setToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(KEYS.TOKEN, token);
    } catch (error) {
      console.error("Failed to store token:", error);
    }
  },

  async removeToken(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEYS.TOKEN);
    } catch (error) {
      console.error("Failed to remove token:", error);
    }
  },

  async getUser<T>(): Promise<T | null> {
    try {
      const data = await SecureStore.getItemAsync(KEYS.USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async setUser<T>(user: T): Promise<void> {
    try {
      await SecureStore.setItemAsync(KEYS.USER, JSON.stringify(user));
    } catch (error) {
      console.error("Failed to store user:", error);
    }
  },

  async removeUser(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEYS.USER);
    } catch (error) {
      console.error("Failed to remove user:", error);
    }
  },

  async clearAll(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEYS.TOKEN);
      await SecureStore.deleteItemAsync(KEYS.USER);
    } catch (error) {
      console.error("Failed to clear storage:", error);
    }
  },

  async getRememberEmail(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEYS.REMEMBER_EMAIL);
    } catch {
      return null;
    }
  },

  async setRememberEmail(email: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(KEYS.REMEMBER_EMAIL, email);
    } catch (error) {
      console.error("Failed to store remember email:", error);
    }
  },

  async removeRememberEmail(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEYS.REMEMBER_EMAIL);
    } catch (error) {
      console.error("Failed to remove remember email:", error);
    }
  },
};

export default storage;
