import { VideoMetadata } from '../types';

export interface UploadProgress {
  percent: number;
  loadedBytes: number;
  totalBytes: number;
  currentChunk: number;
  totalChunks: number;
}

export interface UploadResult {
  uploadedFile: {
    originalName: string;
    savedPath: string;
    size: number;
  };
  metadata: VideoMetadata;
}

const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB chunks (Safely below Cloud Run 32MB HTTP/1.1 limit)

/**
 * Uploads a video file in safe 8MB chunks to bypass proxy and reverse proxy size limits (Cloud Run 32MB limit).
 * Provides granular progress reporting during large file uploads (e.g. 94 MB).
 */
export async function uploadVideoChunked(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  const totalBytes = file.size;
  const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);
  const uploadId = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  let uploadedBytes = 0;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalBytes);
    const chunkBlob = file.slice(start, end);

    const formData = new FormData();
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', chunkIndex.toString());
    formData.append('totalChunks', totalChunks.toString());
    formData.append('filename', file.name);
    formData.append('chunk', chunkBlob, file.name);

    // Use XMLHttpRequest or fetch to transmit chunk
    const response = await fetch('/api/upload/chunk', {
      method: 'POST',
      body: formData,
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error(`خطأ من الخادم أثناء رفع القطعة ${chunkIndex + 1} (${response.status}): ${text.slice(0, 100)}`);
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `فشل في رفع القطعة ${chunkIndex + 1} من ${totalChunks}`);
    }

    uploadedBytes += (end - start);
    const currentPercent = Math.min(Math.round((uploadedBytes / totalBytes) * 100), 99);

    if (onProgress) {
      onProgress({
        percent: currentPercent,
        loadedBytes: uploadedBytes,
        totalBytes,
        currentChunk: chunkIndex + 1,
        totalChunks,
      });
    }

    if (data.done && data.uploadedFile && data.metadata) {
      if (onProgress) {
        onProgress({
          percent: 100,
          loadedBytes: totalBytes,
          totalBytes,
          currentChunk: totalChunks,
          totalChunks,
        });
      }
      return {
        uploadedFile: data.uploadedFile,
        metadata: data.metadata,
      };
    }
  }

  throw new Error('لم تكتمل عملية تجميع قطع الفيديو على الخادم.');
}
