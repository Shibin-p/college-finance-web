import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminAuth, getAdminFirestore, verifySuperCoordinatorCaller } from "./_lib/firebaseAdmin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Always return JSON
  res.setHeader("Content-Type", "application/json");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Enforce POST method
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST", "OPTIONS"]);
    return res.status(405).json({ success: false, error: "Method Not Allowed. Use POST." });
  }

  try {
    // 1. Authenticate caller as active Super Coordinator
    await verifySuperCoordinatorCaller(req);

    // 2. Validate email parameter
    const { email: rawEmail, eventId } = req.body || {};
    if (!rawEmail || typeof rawEmail !== "string" || !rawEmail.trim()) {
      return res.status(400).json({ success: false, error: "Valid email address is required." });
    }

    const email = rawEmail.trim().toLowerCase();
    const auth = getAdminAuth();
    const firestore = getAdminFirestore();

    // 3. Look up Firebase Authentication record (READ-ONLY)
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (authError: any) {
      if (authError.code === "auth/user-not-found") {
        return res.status(200).json({ success: true, exists: false });
      }
      console.error("[check-coordinator] Auth lookup error:", authError);
      return res.status(500).json({
        success: false,
        error: `Authentication lookup error: ${authError.message || "Unknown error"}`,
      });
    }

    // 4. Check if Firestore user profile exists
    let hasFirestoreProfile = false;
    let firestoreRole: string | null = null;
    let firestoreName: string | null = null;
    try {
      const userDoc = await firestore.collection("users").doc(userRecord.uid).get();
      if (userDoc.exists) {
        hasFirestoreProfile = true;
        const data = userDoc.data();
        firestoreRole = data?.role || null;
        firestoreName = data?.name || null;
      }
    } catch (dbError: any) {
      console.warn("[check-coordinator] Firestore user profile check warning:", dbError.message);
    }

    // 5. Check if coordinator assignment exists for the specified event
    let hasEventAssignment = false;
    let assignment: Record<string, any> | null = null;
    if (eventId && typeof eventId === "string") {
      try {
        const assignmentDocId = `${userRecord.uid}_${eventId}`;
        const assignmentDoc = await firestore.collection("coordinatorAssignments").doc(assignmentDocId).get();
        if (assignmentDoc.exists) {
          hasEventAssignment = true;
          assignment = assignmentDoc.data() || null;
        }
      } catch (dbError: any) {
        console.warn("[check-coordinator] Firestore assignment check warning:", dbError.message);
      }
    }

    // 6. Return read-only detected state without modifying anything on Firebase Auth
    return res.status(200).json({
      success: true,
      exists: true,
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName || null,
      disabled: userRecord.disabled || false,
      hasFirestoreProfile,
      hasEventAssignment,
      firestoreRole,
      firestoreName,
      assignment,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    console.error("[check-coordinator] Error:", error.message || error);
    return res.status(statusCode).json({
      success: false,
      error: error.message || "An unexpected error occurred while checking coordinator account.",
    });
  }
}
