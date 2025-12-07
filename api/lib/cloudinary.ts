/**
 * Cloudinary Upload Utility for ELI Application
 * 
 * Handles image uploads to Cloudinary with 'eli-events' folder configuration.
 * Used by webhook handlers to persist snapshot images.
 */

// Cloudinary configuration from environment variables
const CLOUDINARY_FOLDER = "eli-events";

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

interface UploadResult {
  url: string;
  publicId: string;
  secureUrl: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

interface UploadError {
  success: false;
  error: string;
}

type UploadResponse = { success: true; data: UploadResult } | UploadError;

/**
 * Get Cloudinary configuration from environment variables
 * Returns null if not configured
 */
export function getCloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  return { cloudName, apiKey, apiSecret };
}

/**
 * Check if Cloudinary is configured
 */
export function isCloudinaryConfigured(): boolean {
  return getCloudinaryConfig() !== null;
}

/**
 * Upload a base64 image to Cloudinary
 * 
 * @param base64Data - Base64 encoded image data (with or without data URI prefix)
 * @param eventId - Event ID for organizing uploads
 * @param snapshotType - Type of snapshot (e.g., 'FULLSCREEN', 'THUMBNAIL')
 * @returns Upload result with URL and public ID, or error
 */
export async function uploadImage(
  base64Data: string,
  eventId: string,
  snapshotType: string = "UNKNOWN"
): Promise<UploadResponse> {
  const config = getCloudinaryConfig();
  
  if (!config) {
    return {
      success: false,
      error: "Cloudinary not configured - missing credentials",
    };
  }

  try {
    // Ensure base64 data has proper data URI prefix
    let dataUri = base64Data;
    if (!base64Data.startsWith("data:")) {
      // Assume JPEG if no prefix (most common for surveillance images)
      dataUri = `data:image/jpeg;base64,${base64Data}`;
    }

    // Generate a unique public ID for the image
    const timestamp = Date.now();
    const sanitizedEventId = eventId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const publicId = `${CLOUDINARY_FOLDER}/${sanitizedEventId}_${snapshotType}_${timestamp}`;

    // Build the upload URL
    const uploadUrl = `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`;

    // Create form data for upload
    const formData = new FormData();
    formData.append("file", dataUri);
    formData.append("upload_preset", "ml_default"); // Use unsigned upload preset if available
    formData.append("folder", CLOUDINARY_FOLDER);
    formData.append("public_id", `${sanitizedEventId}_${snapshotType}_${timestamp}`);
    
    // For signed uploads, we need to generate a signature
    const uploadTimestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = {
      folder: CLOUDINARY_FOLDER,
      public_id: `${sanitizedEventId}_${snapshotType}_${timestamp}`,
      timestamp: uploadTimestamp,
    };

    // Generate signature using SHA-1
    const signature = await generateSignature(paramsToSign, config.apiSecret);

    // Make the authenticated upload request
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file: dataUri,
        folder: CLOUDINARY_FOLDER,
        public_id: `${sanitizedEventId}_${snapshotType}_${timestamp}`,
        timestamp: uploadTimestamp,
        api_key: config.apiKey,
        signature: signature,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Cloudinary] Upload failed:", response.status, errorText);
      return {
        success: false,
        error: `Upload failed: ${response.status} ${response.statusText}`,
      };
    }

    const result = await response.json();

    console.log("[Cloudinary] Upload successful:", result.public_id);

    return {
      success: true,
      data: {
        url: result.url,
        publicId: result.public_id,
        secureUrl: result.secure_url,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
      },
    };
  } catch (error) {
    console.error("[Cloudinary] Upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown upload error",
    };
  }
}

/**
 * Upload an image from a URL to Cloudinary
 * 
 * @param imageUrl - URL of the image to upload
 * @param eventId - Event ID for organizing uploads
 * @param snapshotType - Type of snapshot
 * @returns Upload result with URL and public ID, or error
 */
export async function uploadImageFromUrl(
  imageUrl: string,
  eventId: string,
  snapshotType: string = "UNKNOWN"
): Promise<UploadResponse> {
  const config = getCloudinaryConfig();
  
  if (!config) {
    return {
      success: false,
      error: "Cloudinary not configured - missing credentials",
    };
  }

  try {
    const timestamp = Date.now();
    const sanitizedEventId = eventId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const uploadUrl = `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`;
    
    const uploadTimestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = {
      folder: CLOUDINARY_FOLDER,
      public_id: `${sanitizedEventId}_${snapshotType}_${timestamp}`,
      timestamp: uploadTimestamp,
    };

    const signature = await generateSignature(paramsToSign, config.apiSecret);

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file: imageUrl,
        folder: CLOUDINARY_FOLDER,
        public_id: `${sanitizedEventId}_${snapshotType}_${timestamp}`,
        timestamp: uploadTimestamp,
        api_key: config.apiKey,
        signature: signature,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Cloudinary] URL upload failed:", response.status, errorText);
      return {
        success: false,
        error: `Upload failed: ${response.status} ${response.statusText}`,
      };
    }

    const result = await response.json();

    console.log("[Cloudinary] URL upload successful:", result.public_id);

    return {
      success: true,
      data: {
        url: result.url,
        publicId: result.public_id,
        secureUrl: result.secure_url,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
      },
    };
  } catch (error) {
    console.error("[Cloudinary] URL upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown upload error",
    };
  }
}

/**
 * Delete an image from Cloudinary by public ID
 * 
 * @param publicId - The public ID of the image to delete
 * @returns Success status
 */
export async function deleteImage(publicId: string): Promise<{ success: boolean; error?: string }> {
  const config = getCloudinaryConfig();
  
  if (!config) {
    return {
      success: false,
      error: "Cloudinary not configured - missing credentials",
    };
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = {
      public_id: publicId,
      timestamp: timestamp,
    };

    const signature = await generateSignature(paramsToSign, config.apiSecret);

    const deleteUrl = `https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`;

    const response = await fetch(deleteUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        public_id: publicId,
        timestamp: timestamp,
        api_key: config.apiKey,
        signature: signature,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Delete failed: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();
    return {
      success: result.result === "ok",
      error: result.result !== "ok" ? `Delete returned: ${result.result}` : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown delete error",
    };
  }
}

/**
 * Generate SHA-1 signature for Cloudinary API authentication
 */
async function generateSignature(
  params: Record<string, string | number>,
  apiSecret: string
): Promise<string> {
  // Sort parameters alphabetically and create the string to sign
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  const stringToSign = sortedParams + apiSecret;

  // Use Web Crypto API for SHA-1 hashing
  const encoder = new TextEncoder();
  const data = encoder.encode(stringToSign);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return hashHex;
}

/**
 * Get the configured Cloudinary folder name
 */
export function getCloudinaryFolder(): string {
  return CLOUDINARY_FOLDER;
}

