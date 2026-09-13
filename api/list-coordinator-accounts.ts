import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { UserRecord } from "firebase-admin/auth";
import { getAdminAuth, getAdminFirestore, verifySuperCoordinatorCaller } from "./_lib/firebaseAdmin";

export interface CoordinatorAccountItem {
  uid: string;
  email: string;
  displayName: string | null;
  disabled: boolean;
  createdAt: string | null;
  lastSignInTime: string | null;
  // Firestore profile details
  hasFirestoreProfile: boolean;
  firestoreRole: string | null;
  firestoreName: string | null;
  firestoreActive: boolean | null;
  firestoreLoginEnabled: boolean | null;
  // Event assignment details
  hasEventAssignment: boolean;
  assignmentId: string | null;
  assignmentType: string | null;
  assignedClassId: string | null;
  assignedClassName: string | null;
  assignmentActive: boolean | null;
  viewerScope: string | null;
  crossClassEnabled: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Always return JSON
  res.setHeader("Content-Type", "application/json");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Enforce GET method
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET", "OPTIONS"]);
    return res.status(405).json({ success: false, error: "Method Not Allowed. Use GET." });
  }

  try {
    // 1. Authenticate caller as active Super Coordinator
    await verifySuperCoordinatorCaller(req);

    const eventId = typeof req.query.eventId === "string" ? req.query.eventId.trim() : undefined;

    const auth = getAdminAuth();
    const firestore = getAdminFirestore();

    // 2. Retrieve all Firebase Authentication users (handle pagination)
    const allAuthUsers: UserRecord[] = [];
    let nextPageToken: string | undefined = undefined;

    do {
      const pageResult = await auth.listUsers(1000, nextPageToken);
      allAuthUsers.push(...pageResult.users);
      nextPageToken = pageResult.pageToken;
    } while (nextPageToken);

    // 3. Retrieve Firestore profiles and event assignments in parallel
    const userDocsPromise = firestore.collection("users").get();
    const classesDocsPromise = firestore.collection("classes").get();
    const assignmentsPromise = eventId
      ? firestore.collection("coordinatorAssignments").where("eventId", "==", eventId).get()
      : Promise.resolve(null);

    const [userSnap, classesSnap, assignmentsSnap] = await Promise.all([
      userDocsPromise,
      classesDocsPromise,
      assignmentsPromise,
    ]);

    // Map profiles by UID
    const profileMap = new Map<string, Record<string, any>>();
    userSnap.forEach((d) => {
      profileMap.set(d.id, d.data());
    });

    // Map class names by classId
    const classMap = new Map<string, string>();
    classesSnap.forEach((d) => {
      const data = d.data();
      classMap.set(d.id, data.displayName || d.id);
    });

    // Map assignments by userId
    const assignmentMap = new Map<string, Record<string, any>>();
    if (assignmentsSnap) {
      assignmentsSnap.forEach((d) => {
        const data = d.data();
        if (data.userId) {
          assignmentMap.set(data.userId, { id: d.id, ...data });
        }
      });
    }

    // 4. Transform and enrich each account with Firestore status
    const accounts: CoordinatorAccountItem[] = allAuthUsers
      .filter((u) => Boolean(u.email)) // Keep only accounts with an email
      .map((u) => {
        const profile = profileMap.get(u.uid);
        const assignment = assignmentMap.get(u.uid);

        let assignedClassName: string | null = null;
        if (assignment?.classId) {
          assignedClassName = classMap.get(assignment.classId) || assignment.classId;
        }

        return {
          uid: u.uid,
          email: u.email || "",
          displayName: u.displayName || profile?.name || null,
          disabled: Boolean(u.disabled),
          createdAt: u.metadata.creationTime || null,
          lastSignInTime: u.metadata.lastSignInTime || null,
          // Firestore Profile
          hasFirestoreProfile: Boolean(profile),
          firestoreRole: profile?.role || null,
          firestoreName: profile?.name || null,
          firestoreActive: profile ? profile.active !== false : null,
          firestoreLoginEnabled: profile ? profile.loginEnabled !== false : null,
          // Event Assignment
          hasEventAssignment: Boolean(assignment),
          assignmentId: assignment?.id || null,
          assignmentType: assignment?.assignmentType || null,
          assignedClassId: assignment?.classId || null,
          assignedClassName,
          assignmentActive: assignment ? assignment.active !== false : null,
          viewerScope: assignment?.viewerScope || null,
          crossClassEnabled: Boolean(assignment?.crossClassCollection?.enabled),
        };
      });

    // 5. Sort accounts alphabetically by email
    accounts.sort((a, b) => a.email.localeCompare(b.email, undefined, { sensitivity: "base" }));

    return res.status(200).json({
      success: true,
      totalCount: accounts.length,
      accounts,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    console.error("[list-coordinator-accounts] Error:", error.message || error);
    return res.status(statusCode).json({
      success: false,
      error: error.message || "Failed to list coordinator accounts.",
    });
  }
}
