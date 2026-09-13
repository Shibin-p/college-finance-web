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
    // 1. Authenticate caller as an active Super Coordinator
    const caller = await verifySuperCoordinatorCaller(req);

    // 2. Extract and validate required payload fields
    const {
      email: rawEmail,
      name: rawName,
      password,
      role,
      accountActive = true,
      loginEnabled = true,
      eventId,
      classId,
      assignmentType,
      permissions,
      viewerScope,
      viewerPermissions,
      crossClassCollection,
      existingUid, // Optional: if already selected from the list
    } = req.body || {};

    if (!rawEmail || typeof rawEmail !== "string" || !rawEmail.trim()) {
      return res.status(400).json({ success: false, error: "Valid coordinator email address is required." });
    }
    if (!rawName || typeof rawName !== "string" || !rawName.trim()) {
      return res.status(400).json({ success: false, error: "Coordinator full name is required." });
    }
    if (!role || (role !== "class_coordinator" && role !== "view_coordinator")) {
      return res.status(400).json({
        success: false,
        error: "Primary role must be strictly 'class_coordinator' or 'view_coordinator'.",
      });
    }
    if (!eventId || typeof eventId !== "string" || !eventId.trim()) {
      return res.status(400).json({ success: false, error: "Active Event ID is required for coordinator assignment." });
    }

    const email = rawEmail.trim().toLowerCase();
    const name = rawName.trim();

    const auth = getAdminAuth();
    const firestore = getAdminFirestore();

    // 3. Verify event exists in Firestore
    const eventDoc = await firestore.collection("events").doc(eventId).get();
    if (!eventDoc.exists) {
      return res.status(404).json({ success: false, error: `Event with ID '${eventId}' not found.` });
    }
    const eventData = eventDoc.data();
    const eventName = eventData?.name || eventId;

    // 4. Validate class requirements based on role
    let validatedClassId = "";
    let className = "";
    if (role === "class_coordinator") {
      if (!classId || typeof classId !== "string" || !classId.trim()) {
        return res.status(400).json({ success: false, error: "A class assignment is required for Class Coordinators." });
      }
      validatedClassId = classId.trim();
      const classDoc = await firestore.collection("classes").doc(validatedClassId).get();
      if (!classDoc.exists) {
        return res.status(404).json({ success: false, error: `Class with ID '${validatedClassId}' was not found in system database.` });
      }
      className = classDoc.data()?.displayName || validatedClassId;
    } else if (role === "view_coordinator" && viewerScope === "specific_class" && classId) {
      validatedClassId = classId.trim();
      const classDoc = await firestore.collection("classes").doc(validatedClassId).get();
      if (classDoc.exists) {
        className = classDoc.data()?.displayName || validatedClassId;
      }
    }

    // 5. Determine whether account already exists in Firebase Auth
    let uid = "";
    let isExistingAuthUser = false;

    if (existingUid && typeof existingUid === "string" && existingUid.trim()) {
      // Direct UID lookup for selected existing account
      try {
        const userByUid = await auth.getUser(existingUid.trim());
        uid = userByUid.uid;
        isExistingAuthUser = true;
      } catch (uidErr: any) {
        console.warn("[onboard-coordinator] User lookup by UID failed, trying email:", uidErr.message);
      }
    }

    if (!isExistingAuthUser) {
      try {
        const existingAuthUser = await auth.getUserByEmail(email);
        uid = existingAuthUser.uid;
        isExistingAuthUser = true;
        // IMPORTANT: Strictly READ-ONLY on Firebase Authentication for existing users.
        // Do not update password, email, or disabled status. Never call updateUser.
      } catch (authErr: any) {
        if (authErr.code === "auth/user-not-found") {
          isExistingAuthUser = false;
        } else {
          console.error("[onboard-coordinator] Auth lookup error:", authErr);
          return res.status(500).json({
            success: false,
            error: `Firebase Auth verification failed: ${authErr.message || authErr}`,
          });
        }
      }
    }

    // 6. If account does not exist, create a new Firebase Auth user
    if (!isExistingAuthUser) {
      if (!password || typeof password !== "string" || password.length < 6) {
        return res.status(400).json({
          success: false,
          error: "An initial password of at least 6 characters is required to create a new coordinator account.",
        });
      }

      try {
        const newAuthUser = await auth.createUser({
          email,
          password,
          displayName: name,
          disabled: loginEnabled === false,
        });
        uid = newAuthUser.uid;
      } catch (createErr: any) {
        console.error("[onboard-coordinator] Auth create error:", createErr);
        return res.status(400).json({
          success: false,
          error: `Failed to create Firebase Authentication account: ${createErr.message || createErr}`,
        });
      }
    }

    // 7. Prepare standard role permissions
    const finalPermissions = {
      canView: role === "class_coordinator" ? Boolean(permissions?.canView ?? true) : false,
      canViewStudents: role === "class_coordinator" ? Boolean(permissions?.canViewStudents ?? true) : false,
      canAddPayment: role === "class_coordinator" ? Boolean(permissions?.canAddPayment ?? true) : false,
      canAddInstallment: role === "class_coordinator" ? Boolean(permissions?.canAddInstallment ?? true) : false,
      canEditPayment: role === "class_coordinator" ? Boolean(permissions?.canEditPayment ?? false) : false,
      canViewReports: role === "class_coordinator" ? Boolean(permissions?.canViewReports ?? true) : false,
    };

    const finalViewerPermissions = {
      canViewAggregate: role === "view_coordinator" ? Boolean(viewerPermissions?.canViewAggregate ?? true) : false,
      canViewStudentCollectionStatus:
        role === "view_coordinator" ? Boolean(viewerPermissions?.canViewStudentCollectionStatus ?? false) : false,
      canViewExpenses: role === "view_coordinator" ? Boolean(viewerPermissions?.canViewExpenses ?? false) : false,
      canViewExpenseCategories:
        role === "view_coordinator" ? Boolean(viewerPermissions?.canViewExpenseCategories ?? false) : false,
    };

    // 8. Cross-Class Collection Assistant configuration
    const isAssistantEnabled = Boolean(crossClassCollection?.enabled);
    const authorizedClassIds = isAssistantEnabled && Array.isArray(crossClassCollection?.authorizedClassIds)
      ? crossClassCollection.authorizedClassIds
      : [];

    const finalCrossClassCollection = {
      enabled: isAssistantEnabled,
      authorizedClassIds,
      capabilities: {
        canViewCollection: isAssistantEnabled ? Boolean(crossClassCollection?.capabilities?.canViewCollection ?? true) : false,
        canAddPayment: isAssistantEnabled ? Boolean(crossClassCollection?.capabilities?.canAddPayment ?? false) : false,
        canAddInstallment: isAssistantEnabled ? Boolean(crossClassCollection?.capabilities?.canAddInstallment ?? false) : false,
        canHandlePendingApprovals: isAssistantEnabled
          ? Boolean(crossClassCollection?.capabilities?.canHandlePendingApprovals ?? false)
          : false,
        canAccessCentralReceipts: isAssistantEnabled
          ? Boolean(crossClassCollection?.capabilities?.canAccessCentralReceipts ?? false)
          : false,
      },
    };

    const nowIso = new Date().toISOString();

    // 9. Create/update Firestore user profile
    const userRef = firestore.collection("users").doc(uid);
    const existingUserDoc = await userRef.get();

    const userProfileData: Record<string, any> = {
      uid,
      email,
      name,
      role,
      active: accountActive !== false,
      loginEnabled: loginEnabled !== false,
      updatedAt: nowIso,
      lastAssignedEventId: eventId,
    };

    if (!existingUserDoc.exists) {
      userProfileData.createdAt = nowIso;
      await userRef.set(userProfileData);
    } else {
      await userRef.set(userProfileData, { merge: true });
    }

    // 10. Create/update coordinator assignment with deterministic ID
    const assignmentId = `${uid}_${eventId}`;
    const assignmentRef = firestore.collection("coordinatorAssignments").doc(assignmentId);
    const existingAssignmentDoc = await assignmentRef.get();

    const assignmentData: Record<string, any> = {
      id: assignmentId,
      userId: uid,
      eventId,
      classId: validatedClassId,
      active: accountActive !== false,
      assignmentType: assignmentType || role,
      permissions: finalPermissions,
      viewerScope: role === "view_coordinator" ? (viewerScope || "whole_event") : "whole_event",
      viewerPermissions: finalViewerPermissions,
      crossClassCollection: finalCrossClassCollection,
      assignedBy: caller.uid,
      assignedByName: caller.name,
      updatedAt: nowIso,
      updatedBy: caller.uid,
    };

    if (!existingAssignmentDoc.exists) {
      assignmentData.assignedAt = nowIso;
      await assignmentRef.set(assignmentData);
    } else {
      await assignmentRef.set(assignmentData, { merge: true });
    }

    // 11. Write immutable audit log
    const auditAction = isExistingAuthUser ? "COORDINATOR_LINKED" : "COORDINATOR_ONBOARDED";
    const auditDescription = isExistingAuthUser
      ? `Linked existing Firebase Auth account for coordinator ${name} (${email}) as ${role}${className ? ` for class ${className}` : ""}`
      : `Onboarded new coordinator ${name} (${email}) as ${role}${className ? ` for class ${className}` : ""}`;

    await firestore.collection("auditLogs").add({
      timestamp: nowIso,
      userId: caller.uid,
      userRole: "super_coordinator",
      userName: caller.name,
      action: auditAction,
      category: "user_management",
      eventId,
      eventName,
      classId: validatedClassId || null,
      className: className || null,
      description: auditDescription,
      metadata: {
        targetUid: uid,
        targetEmail: email,
        targetName: name,
        role,
        assignmentId,
        isExistingAuthUser,
        crossClassCollectionEnabled: isAssistantEnabled,
        authorizedClassesCount: authorizedClassIds.length,
      },
    });

    const mode = isExistingAuthUser ? "linked" : "created";
    return res.status(200).json({
      success: true,
      uid,
      mode,
      message: isExistingAuthUser
        ? `Existing coordinator account for ${name} (${email}) was successfully linked to event '${eventName}'. Firebase Authentication credentials remained untouched.`
        : `New coordinator account for ${name} (${email}) was created and assigned to event '${eventName}'.`,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    console.error("[onboard-coordinator] Error:", error.message || error);
    return res.status(statusCode).json({
      success: false,
      error: error.message || "An unexpected error occurred while onboarding coordinator.",
    });
  }
}
