import axios, { AxiosProgressEvent } from "axios";
import * as FileSystem from "expo-file-system";
import config from "@/lib/config";
import storage from "@/lib/storage";

interface UploadOptions {
  inviteToken: string;
  questionId: string;
  videoUri: string;
  onProgress?: (progress: number) => void;
  onChunkProgress?: (chunk: number, total: number) => void;
}

interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await storage.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function uploadSingleVideo({
  inviteToken,
  questionId,
  videoUri,
  onProgress,
}: UploadOptions): Promise<UploadResult> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(videoUri);
    if (!fileInfo.exists) {
      return { success: false, error: "Video file not found" };
    }

    const fileSize = "size" in fileInfo ? fileInfo.size : 0;
    const headers = await getAuthHeaders();

    if (fileSize > config.UPLOAD_CHUNK_SIZE) {
      return uploadChunked({ inviteToken, questionId, videoUri, fileSize, onProgress });
    }

    const formData = new FormData();
    const filename = videoUri.split("/").pop() || "video.mp4";
    const mimeType = filename.endsWith(".mp4") ? "video/mp4" : "video/quicktime";

    formData.append("video", {
      uri: videoUri,
      name: filename,
      type: mimeType,
    } as unknown as Blob);
    formData.append("question_id", questionId);

    const response = await axios.post(
      `${config.API_BASE_URL}/interviews/candidate/${inviteToken}/answers`,
      formData,
      {
        headers: {
          ...headers,
          "Content-Type": "multipart/form-data",
        },
        timeout: 120000,
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          if (progressEvent.total && onProgress) {
            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(percent);
          }
        },
      }
    );

    return { success: true, url: response.data?.answer?.video_url };
  } catch (error: unknown) {
    const message =
      error && typeof error === "object" && "message" in error
        ? (error as { message: string }).message
        : "Upload failed";
    return { success: false, error: message };
  }
}

async function uploadChunked({
  inviteToken,
  questionId,
  videoUri,
  fileSize,
  onProgress,
}: UploadOptions & { fileSize: number }): Promise<UploadResult> {
  try {
    const chunkSize = config.UPLOAD_CHUNK_SIZE;
    const totalChunks = Math.ceil(fileSize / chunkSize);
    const headers = await getAuthHeaders();
    const uploadId = `${Date.now()}_${questionId}`;

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, fileSize);

      const chunkData = await FileSystem.readAsStringAsync(videoUri, {
        encoding: FileSystem.EncodingType.Base64,
        length: end - start,
        position: start,
      });

      const formData = new FormData();
      formData.append("chunk", chunkData);
      formData.append("chunk_index", String(chunkIndex));
      formData.append("total_chunks", String(totalChunks));
      formData.append("upload_id", uploadId);
      formData.append("question_id", questionId);

      const response = await axios.post(
        `${config.API_BASE_URL}/interviews/candidate/${inviteToken}/answers/upload-chunk`,
        formData,
        {
          headers: {
            ...headers,
            "Content-Type": "multipart/form-data",
          },
          timeout: 60000,
        }
      );

      if (onProgress) {
        const overallProgress = Math.round(
          ((chunkIndex + 1) / totalChunks) * 100
        );
        onProgress(overallProgress);
      }

      if (response.data?.status_text === "complete") {
        return { success: true, url: response.data?.video_url };
      }
    }

    const completeResponse = await axios.post(
      `${config.API_BASE_URL}/interviews/candidate/${inviteToken}/answers/complete-upload`,
      { upload_id: uploadId, question_id: questionId, total_chunks: totalChunks },
      { headers }
    );

    return { success: true, url: completeResponse.data?.video_url };
  } catch (error: unknown) {
    const message =
      error && typeof error === "object" && "message" in error
        ? (error as { message: string }).message
        : "Chunked upload failed";
    return { success: false, error: message };
  }
}

export default { uploadSingleVideo };
