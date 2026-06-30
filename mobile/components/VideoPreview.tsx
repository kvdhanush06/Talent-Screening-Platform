import React, { useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Video, ResizeMode } from "expo-av";

interface VideoPreviewProps {
  videoUri: string;
  onReRecord: () => void;
  onConfirm: () => void;
  isUploading?: boolean;
}

export default function VideoPreview({
  videoUri,
  onReRecord,
  onConfirm,
  isUploading = false,
}: VideoPreviewProps) {
  const videoRef = useRef<Video>(null);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Review your answer</Text>
      <Text style={styles.subtitle}>
        Watch your recording below. You can re-record if needed.
      </Text>

      <View style={styles.videoContainer}>
        <Video
          ref={videoRef}
          source={{ uri: videoUri }}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          useNativeControls
          shouldPlay
          isLooping={false}
        />
      </View>

      {isUploading ? (
        <View style={styles.uploading}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.uploadingText}>Uploading your answer...</Text>
        </View>
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.reRecordButton}
            onPress={onReRecord}
          >
            <Text style={styles.reRecordText}>Re-record</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={onConfirm}
          >
            <Text style={styles.confirmText}>Use this recording</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#F8FAFC",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 16,
    lineHeight: 20,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: "#000",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  video: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    paddingBottom: 8,
  },
  reRecordButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  reRecordText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#475569",
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
  },
  confirmText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  uploading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
  },
  uploadingText: {
    fontSize: 15,
    color: "#64748B",
    fontWeight: "500",
  },
});
