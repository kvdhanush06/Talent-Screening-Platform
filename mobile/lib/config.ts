const config = {
  API_BASE_URL: process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/api/v1",
  API_TIMEOUT: 30000,
  UPLOAD_CHUNK_SIZE: 5 * 1024 * 1024, // 5MB chunks
  MAX_RECORDING_SECONDS: 120,
  WARNING_TIME_SECONDS: 15,
  REFRESH_INTERVAL_MS: 30000,
};

export default config;
