import { auth } from "../firebase/auth";
import type {
  CoordinatorPermissions,
  ViewerPermissions,
  ViewerScope,
  CrossClassCapabilities,
} from "../types";

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
  existingUid?: string;
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
 * Helper to safely parse API responses with user-friendly error diagnostics for Vercel.
 */
async function parseApiResponse(response: Response, endpointName: string): Promise<any> {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    if (response.status === 404) {
      throw new Error(
        `API endpoint ${endpointName} was not found (404). Please ensure the latest project commit with the /api directory is deployed on Vercel.`
      );
    }
    if (response.status >= 500) {
      throw new Error(
        `Server configuration error (${response.status}) from ${endpointName}. Please ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables are configured in your Vercel Project Settings.`
      );
    }
    throw new Error(`Server returned non-JSON response (${response.status} ${response.statusText}).`);
  }

  let data: any;
  try {
    data = await response.json();
  } catch (jsonErr: any) {
    throw new Error(`Failed to parse JSON response from ${endpointName}.`, { cause: jsonErr });
  }

  if (!response.ok || data?.success === false) {
    const errorMsg = data?.error || `Request to ${endpointName} failed (${response.status} ${response.statusText})`;
    throw new Error(errorMsg);
  }

  return data;
}

/**
 * listCoordinatorAccounts:
 * Calls GET /api/list-coordinator-accounts.
 * Retrieves all Firebase Authentication accounts (with pagination handled server-side),
 * enriched with their Firestore profile existence and current event assignment status.
 */
export async function listCoordinatorAccounts(
  eventId?: string
): Promise<CoordinatorAccountItem[]> {
  const token = await getAuthToken();
  const url = eventId
    ? `/api/list-coordinator-accounts?eventId=${encodeURIComponent(eventId)}`
    : "/api/list-coordinator-accounts";

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (networkError: any) {
    console.error("Network error calling /api/list-coordinator-accounts:", networkError);
    throw new Error(
      "Unable to reach the server API. Please check your internet connection and verify the Vercel deployment.",
      { cause: networkError }
    );
  }

  const data = await parseApiResponse(response, "/api/list-coordinator-accounts");
  return data.accounts || [];
}

/**
 * checkCoordinatorAccount:
 * Calls POST /api/check-coordinator.
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

  const resultData = await parseApiResponse(response, "/api/check-coordinator");

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
 * Calls POST /api/onboard-coordinator.
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

  const resultData = await parseApiResponse(response, "/api/onboard-coordinator");

  return {
    success: true,
    uid: resultData.uid,
    isExistingAuthUser: resultData.mode === "linked",
    message: resultData.message,
  };
}
