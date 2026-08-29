import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  sendPasswordResetEmail,
  type User as FirebaseUser,
  type UserCredential,
} from "firebase/auth";
import { firebaseApp } from "./config";

export const auth = getAuth(firebaseApp);
export type { FirebaseUser, UserCredential };

export async function loginWithEmailPassword(
  email: string,
  pass: string
): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email.trim(), pass);
}

export async function logoutUser(): Promise<void> {
  return signOut(auth);
}

export async function resetPassword(email: string): Promise<void> {
  return sendPasswordResetEmail(auth, email.trim());
}

export function onAuthStateChanged(
  authInstance: typeof auth,
  callback: (user: FirebaseUser | null) => void
) {
  return firebaseOnAuthStateChanged(authInstance, callback);
}