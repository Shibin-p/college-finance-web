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

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  const projectIdPresent = Boolean(projectId);
  const clientEmailPresent = Boolean(clientEmail);
  const privateKeyPresent = Boolean(rawPrivateKey);

  let keyBeginsCorrectly = false;
  let keyEndsCorrectly = false;
  if (rawPrivateKey) {
    let pk = rawPrivateKey.trim();
    if ((pk.startsWith('"') && pk.endsWith('"')) || (pk.startsWith("'") && pk.endsWith("'"))) {
      pk = pk.slice(1, -1).trim();
    }
    keyBeginsCorrectly = pk.startsWith("-----BEGIN PRIVATE KEY-----");
    keyEndsCorrectly =
      pk.endsWith("-----END PRIVATE KEY-----") ||
      pk.endsWith("-----END PRIVATE KEY-----\\n") ||
      pk.endsWith("-----END PRIVATE KEY-----\n");
  }

  console.log(
    `[coordinator-api] env-check: FIREBASE_PROJECT_ID=${
      projectIdPresent ? (projectId === "college-finance-web" ? "OK(college-finance-web)" : `PRESENT(${projectId})`) : "MISSING"
    }, FIREBASE_CLIENT_EMAIL=${clientEmailPresent ? "PRESENT" : "MISSING"}, FIREBASE_PRIVATE_KEY=${
      privateKeyPresent ? "PRESENT" : "MISSING"
    }, keyBegins=${keyBeginsCorrectly}, keyEnds=${keyEndsCorrectly}`
  );

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
    console.error(`[coordinator-api] admin-init: FAILED - ${err.message}`);
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

  // 3. Replace literal escaped \n and strip \r
  privateKey = privateKey.replace(/\\n/g, "\n").replace(/\\r/g, "");

  try {
    const app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    console.log("[coordinator-api] admin-init: OK");
    return app;
  } catch (initError: any) {
    const appsAfterCatch = getApps();
    if (appsAfterCatch.length > 0 && appsAfterCatch[0]) {
      console.log("[coordinator-api] admin-init: OK (app already existed)");
      return appsAfterCatch[0];
    }
    const err = new Error(
      `Firebase Admin Initialization Error: Failed to parse credentials. Please check FIREBASE_PRIVATE_KEY formatting in Vercel Settings. (${
        initError.message || initError
      })`
    );
    (err as any).statusCode = 500;
    console.error(`[coordinator-api] admin-init: FAILED - ${err.message}`);
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
    console.error("[coordinator-api] token-verification: FAILED - Missing or invalid Authorization header");
    const err = new Error("Unauthenticated: Missing or invalid Authorization header. Expected Bearer token.");
    (err as any).statusCode = 401;
    throw err;
  }

  const idToken = authHeader.split(" ")[1]?.trim();
  if (!idToken) {
    console.error("[coordinator-api] token-verification: FAILED - Empty Bearer token provided");
    const err = new Error("Unauthenticated: Empty Bearer token provided.");
    (err as any).statusCode = 401;
    throw err;
  }

  console.log("[coordinator-api] token-verification: START");
  const auth = getAdminAuth();
  const firestore = getAdminFirestore();

  let decodedToken: DecodedIdToken;
  try {
    decodedToken = await auth.verifyIdToken(idToken);
    console.log(`[coordinator-api] token-verification: OK (callerUid: ${decodedToken.uid.slice(0, 6)}...)`);
  } catch (verifyError: any) {
    console.error("[coordinator-api] token-verification: FAILED -", verifyError.message || verifyError);
    const err = new Error(`Unauthenticated: Invalid or expired ID token (${verifyError.message || "token verification failed"}). Please refresh and sign in again.`);
    (err as any).statusCode = 401;
    throw err;
  }

  console.log("[coordinator-api] caller-profile: START");
  const callerUid = decodedToken.uid;
  let userDoc;
  try {
    userDoc = await firestore.collection("users").doc(callerUid).get();
  } catch (fsError: any) {
    console.error("[coordinator-api] caller-profile: FAILED (Firestore read error) -", fsError.message || fsError);
    const err = new Error(`Database read error: Failed to fetch caller profile (${fsError.message || fsError})`);
    (err as any).statusCode = 500;
    throw err;
  }

  if (!userDoc.exists) {
    console.error(`[coordinator-api] caller-profile: FAILED - User document users/${callerUid.slice(0, 6)} does not exist`);
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
    console.error(`[coordinator-api] caller-profile: FAILED - Caller is not an active super_coordinator (role: ${userData?.role}, active: ${userData?.active})`);
    const err = new Error("Access Denied: Privileged operation. Only active Super Coordinators are authorized.");
    (err as any).statusCode = 403;
    throw err;
  }

  console.log(`[coordinator-api] caller-profile: OK (role: ${userData.role})`);
  return {
    uid: callerUid,
    email: decodedToken.email || userData.email,
    name: userData.name || "Super Coordinator",
  };
}

export interface CentralReceiptCallerInfo {
  uid: string;
  email?: string;
  name: string;
  role: string;
  roleTitle: string;
}

export async function verifyCentralReceiptAccessCaller(
  req: VercelRequest,
  eventId: string
): Promise<CentralReceiptCallerInfo> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const err = new Error("Unauthenticated: Missing or malformed Authorization Bearer header.");
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
    const err = new Error(
      `Unauthenticated: Invalid or expired ID token (${verifyError.message || "token verification failed"}).`
    );
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
  if (!userData || userData.active === false || userData.loginEnabled === false) {
    const err = new Error("Access Denied: Account is deactivated or disabled.");
    (err as any).statusCode = 403;
    throw err;
  }

  // 1. Super Coordinator has unrestricted access
  if (userData.role === "super_coordinator") {
    return {
      uid: callerUid,
      email: decodedToken.email || userData.email,
      name: userData.name || "Super Coordinator",
      role: "super_coordinator",
      roleTitle: "Super Coordinator",
    };
  }

  // 2. Cross-Class Assistant must have canAccessCentralReceipts enabled for this event
  const assignmentsSnap = await firestore
    .collection("coordinatorAssignments")
    .where("userId", "==", callerUid)
    .where("eventId", "==", eventId)
    .where("active", "==", true)
    .get();

  let hasCentralAccess = false;
  assignmentsSnap.forEach((doc) => {
    const data = doc.data();
    if (
      data.crossClassCollection?.enabled === true &&
      data.crossClassCollection?.capabilities?.canAccessCentralReceipts === true
    ) {
      hasCentralAccess = true;
    }
  });

  if (!hasCentralAccess) {
    const err = new Error("Access Denied: You do not have permission to access Central Receipts.");
    (err as any).statusCode = 403;
    throw err;
  }

  return {
    uid: callerUid,
    email: decodedToken.email || userData.email,
    name: userData.name || "Cross-Class Collection Assistant",
    role: userData.role,
    roleTitle: "Cross-Class Collection Assistant",
  };
}
