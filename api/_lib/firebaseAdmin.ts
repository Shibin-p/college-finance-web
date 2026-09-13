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
 * - FIREBASE_PRIVATE_KEY (with robust quotes, \n, and \r formatting support)
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
    const missing: string[] = [];
    if (!projectId) missing.push("FIREBASE_PROJECT_ID");
    if (!clientEmail) missing.push("FIREBASE_CLIENT_EMAIL");
    if (!rawPrivateKey) missing.push("FIREBASE_PRIVATE_KEY");

    const err = new Error(
      `Server Configuration Error: Missing Firebase Admin environment variable(s) on Vercel: ${missing.join(
        ", "
      )}. Please configure them in your Vercel Project Settings under Environment Variables.`
    );
    (err as any).statusCode = 500;
    throw err;
  }

  // Robust private key formatting:
  // 1. Trim surrounding whitespace
  let privateKey = rawPrivateKey.trim();

  // 2. Strip surrounding wrapping quotes if accidentally entered in Vercel UI
  if (
    (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
    (privateKey.startsWith("'") && privateKey.endsWith("'"))
  ) {
    privateKey = privateKey.slice(1, -1).trim();
  }

  // 3. Replace escaped \n and strip \r
  privateKey = privateKey.replace(/\\n/g, "\n").replace(/\\r/g, "");

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
    const err = new Error(
      `Firebase Admin Initialization Error: Failed to parse credentials. Please check FIREBASE_PRIVATE_KEY formatting in Vercel Settings. (${
        initError.message || initError
      })`
    );
    (err as any).statusCode = 500;
    throw err;
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
    const err = new Error(`Unauthenticated: Invalid or expired ID token (${verifyError.message || "token verification failed"}). Please refresh and sign in again.`);
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
