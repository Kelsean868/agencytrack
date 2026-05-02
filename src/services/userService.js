import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage, tenantId } from '../firebase';

export async function updateUserProfile(uid, fields) {
  const docRef = doc(db, `tenants/${tenantId}/users/${uid}`);
  await updateDoc(docRef, { ...fields, updatedAt: serverTimestamp() });
}

// Compress an image File/Blob to maxDim × maxDim, returns a Blob (image/jpeg)
export function compressImage(file, maxDim = 400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas toBlob failed'));
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Upload compressed blob to Storage, update photoURL in Firestore
// onProgress: (0–100) => void
export function uploadProfilePhoto(uid, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, `avatars/${tenantId}/${uid}.jpg`);
    const task = uploadBytesResumable(storageRef, blob, { contentType: 'image/jpeg' });

    task.on(
      'state_changed',
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        onProgress?.(pct);
      },
      reject,
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          await updateUserProfile(uid, { photoURL: url });
          resolve(url);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}
