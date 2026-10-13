import * as FileSystem from 'expo-file-system/legacy';
import { ref, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '../firebase';

/**
 * Uploads a local file straight to Firebase Storage and returns its download
 * URL — same direct-upload pattern as EditProfileModal's profile photo
 * (bypasses the JS Blob layer entirely, bytes go straight from disk to the
 * network), generalized here for any file type (images or documents), not
 * just a re-encoded JPEG.
 *
 * Setup gap, not a code issue: Storage security rules must allow a signed-in
 * user to write to their own `feedback-attachments/{uid}/**` path, same as
 * the existing `profile-photos/{uid}.jpg` rule.
 */
export async function uploadFeedbackAttachment({ uri, name, mimeType }) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in.');

  const safeName = (name || `attachment-${Date.now()}`).replace(/[^\w.-]/g, '_');
  const objectPath = `feedback-attachments/${uid}/${Date.now()}-${safeName}`;
  const bucket = storage.app.options.storageBucket;
  const idToken = await auth.currentUser.getIdToken();
  const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(objectPath)}`;

  const uploadResult = await FileSystem.uploadAsync(uploadUrl, uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': mimeType || 'application/octet-stream',
    },
  });
  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    throw new Error(`Upload failed (${uploadResult.status})`);
  }

  return getDownloadURL(ref(storage, objectPath));
}
