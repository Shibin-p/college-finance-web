import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth, type DecodedIdToken } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { VercelRequest } from "@vercel/node";

export interface CallerInfo {
  uid: string;
  email?: string;
  name: string;
}

/**
 * Initializes and returns the Firebase Admin App singleton.
 * Uses Vercel server-side environment variables:
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_CLIENT_EMAIL
 * - FIREBASE_PRIVATE_KEY (with newline formatting support)
 */
export function getFirebaseAdminApp(): App {
  const existingApps = getApps();
  if (existingApps.length > 0 && existingApps[0]) {
    return existingApps[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawPrivateKey) {
    throw new Error(
      "Server Configuration Error: Missing Firebase Admin environment variables on Vercel. " +
        "Please ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set."
    );
  }

  // Properly handle literal \n characters commonly saved in Vercel environment variables
  const privateKey = rawPrivateKey.includes("\\n")
    ? rawPrivateKey.replace(/\\n/g, "\n")
    : rawPrivateKey;

  try {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } catch (initError: any) {
    const appsAfterCatch = getApps();
    if (appsAfterCatch.length > 0 && appsAfterCatch[0]) {
      return appsAfterCatch[0];
    }
    throw initError;
  }
}

export function getAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export function getAdminFirestore(): Firestore {
  return getFirestore(getFirebaseAdminApp());
}

/**
 * Verifies the caller's Firebase Authentication ID token from the Authorization header,
 * reads their Firestore user profile, and ensures they are an active Super Coordinator.
 * Never trusts any role or claim supplied in the client request body.
 */
export async function verifySuperCoordinatorCaller(
  req: VercelRequest
): Promise<CallerInfo> {
  const authHeader =
    (req.headers.authorization as string | undefined) ||
    (req.headers.Authorization as string | undefined);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const err = new Error("Unauthenticated: Missing or invalid Authorization header. Expected Bearer token.");
    (err as any).statusCode = 401;
    throw err;
  }

  const idToken = authHeader.split(" ")[1]?.trim();
  if (!idToken) {
    const err = new Error("Unauthenticated: Empty Bearer token provided.");
    (err as any).statusCode = 401;
    throw err;
  }

  const auth = getAdminAuth();
  const firestore = getAdminFirestore();

  let decodedToken: DecodedIdToken;
  try {
    decodedToken = await auth.verifyIdToken(idToken);
  } catch (verifyError: any) {
    const err = new Error(`Unauthenticated: Invalid or expired ID token (${verifyError.message || "token verification failed"}).`);
    (err as any).statusCode = 401;
    throw err;
  }

  const callerUid = decodedToken.uid;
  const userDoc = await firestore.collection("users").doc(callerUid).get();

  if (!userDoc.exists) {
    const err = new Error("Access Denied: Caller account does not exist in the system database.");
    (err as any).statusCode = 403;
    throw err;
  }

  const userData = userDoc.data();
  if (
    !userData ||
    userData.role !== "super_coordinator" ||
    userData.active === false ||
    userData.loginEnabled === false
  ) {
    const err = new Error("Access Denied: Privileged operation. Only active Super Coordinators are authorized.");
    (err as any).statusCode = 403;
    throw err;
  }

  return {
    uid: callerUid,
    email: decodedToken.email || userData.email,
    name: userData.name || "Super Coordinator",
  };
}
