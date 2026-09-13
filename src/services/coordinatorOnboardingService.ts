import { auth } from "../firebase/auth";
import type {
  CoordinatorPermissions,
  ViewerPermissions,
  ViewerScope,
  CrossClassCapabilities,
} from "../types";

export interface CheckCoordinatorResult {
  exists: boolean;
  uid?: string;
  email?: string;
  displayName?: string;
  disabled?: boolean;
  hasFirestoreProfile?: boolean;
  firestoreRole?: string | null;
  firestoreName?: string | null;
  firestoreUser?: {
    name: string;
    email: string;
    role: string;
    active: boolean;
    loginEnabled: boolean;
  } | null;
  hasEventAssignment?: boolean;
  existingAssignment?: {
    id: string;
    assignmentType: string;
    classId: string;
    active: boolean;
  } | null;
}

export interface OnboardCoordinatorParams {
  email: string;
  name: string;
  password?: string;
  role: "class_coordinator" | "view_coordinator";
  accountActive?: boolean;
  loginEnabled?: boolean;
  eventId: string;
  classId?: string;
  assignmentType?: "class_coordinator" | "view_coordinator";
  permissions?: Partial<CoordinatorPermissions>;
  viewerScope?: ViewerScope;
  viewerPermissions?: Partial<ViewerPermissions>;
  crossClassCollection?: {
    enabled: boolean;
    authorizedClassIds: string[];
    capabilities: CrossClassCapabilities;
  };
}

export interface OnboardCoordinatorResult {
  success: boolean;
  uid: string;
  isExistingAuthUser: boolean;
  message: string;
}

/**
 * Helper to retrieve the current user's Firebase Auth ID token for authenticating Vercel API requests.
 */
async function getAuthToken(): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Your session has expired. Please sign in again as Super Coordinator.");
  }
  return currentUser.getIdToken();
}

/**
 * checkCoordinatorAccount:
 * Calls the secure Vercel serverless API endpoint /api/check-coordinator.
 * Detects whether a Firebase Auth user exists for the given email in a READ-ONLY manner.
 * NO client-side fallback.
 */
export async function checkCoordinatorAccount(
  email: string,
  eventId?: string
): Promise<CheckCoordinatorResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error("Please provide an email address to check.");
  }

  const token = await getAuthToken();

  let response: Response;
  try {
    response = await fetch("/api/check-coordinator", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email: cleanEmail, eventId }),
    });
  } catch (networkError: any) {
    console.error("Network error calling /api/check-coordinator:", networkError);
    throw new Error(
      "Unable to reach the server API. Please check your internet connection and verify the Vercel deployment.",
      { cause: networkError }
    );
  }

  let resultData: any;
  try {
    resultData = await response.json();
  } catch (jsonErr: any) {
    throw new Error(`Server returned non-JSON response (${response.status} ${response.statusText})`, {
      cause: jsonErr,
    });
  }

  if (!response.ok) {
    const errorMsg =
      resultData?.error || `Failed to check account (${response.status} ${response.statusText})`;
    throw new Error(errorMsg);
  }

  return {
    ...resultData,
    firestoreUser:
      resultData.firestoreRole && resultData.firestoreName
        ? {
            name: resultData.firestoreName,
            email: resultData.email || cleanEmail,
            role: resultData.firestoreRole,
            active: !resultData.disabled,
            loginEnabled: !resultData.disabled,
          }
        : resultData.firestoreUser || null,
  };
}

/**
 * onboardCoordinatorAccount:
 * Calls the secure Vercel serverless API endpoint /api/onboard-coordinator.
 * For existing accounts: Strictly read-only on Auth (preserves existing password, email, and disabled status).
 * For new accounts: Creates Firebase Auth account with provided password.
 * Provisions Firestore users/{uid} and coordinatorAssignments/{uid}_{eventId}.
 * NO client-side fallback.
 */
export async function onboardCoordinatorAccount(
  params: OnboardCoordinatorParams
): Promise<OnboardCoordinatorResult> {
  const token = await getAuthToken();

  let response: Response;
  try {
    response = await fetch("/api/onboard-coordinator", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });
  } catch (networkError: any) {
    console.error("Network error calling /api/onboard-coordinator:", networkError);
    throw new Error(
      "Unable to reach the server API. Please check your internet connection and verify the Vercel deployment.",
      { cause: networkError }
    );
  }

  let resultData: any;
  try {
    resultData = await response.json();
  } catch (jsonErr: any) {
    throw new Error(`Server returned non-JSON response (${response.status} ${response.statusText})`, {
      cause: jsonErr,
    });
  }

  if (!response.ok) {
    const errorMsg =
      resultData?.error || `Failed to onboard coordinator (${response.status} ${response.statusText})`;
    throw new Error(errorMsg);
  }

  return {
    success: true,
    uid: resultData.uid,
    isExistingAuthUser: resultData.mode === "linked",
    message: resultData.message,
  };
}
