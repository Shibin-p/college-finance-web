# Implementation Plan — Coordinator Onboarding Automation

Automate coordinator onboarding in the EKCTC Finance application so the Super Coordinator can link existing 50+ Firebase Authentication accounts and create new coordinator accounts directly within the UI, eliminating the manual multi-step Firebase Console workflow while preserving all existing roles, permissions, passwords, and security controls.

## User Review Required

> [!IMPORTANT]
> - **Zero Modification to Existing Firebase Auth Records During Linking**: For existing Auth accounts, the linking operation is **strictly read-only on Firebase Authentication**. The server retrieves the existing UID via Firebase Admin SDK without modifying the user's password, email, disabled/enabled status, or other Auth properties. Only the Firestore `users/{UID}` profile and `coordinatorAssignments/{UID}_{eventId}` documents are created or updated.
> - **Strict Server-Side Execution (NO Client-Side Fallback)**: All privileged operations (`getUserByEmail`, `createUser`, and initial coordinator provisioning) are executed **exclusively** through secure Firebase Callable Cloud Functions (`functions/index.js`) using Firebase Admin SDK and caller authentication (strictly requiring an active `super_coordinator`). There is **NO** client-side fallback. If the Cloud Function is unavailable or fails, a clear user-friendly error is displayed and no direct client-side UID operations are performed.
> - **Primary Roles & Capability Separation**:
>   - **Primary Roles**: Strictly either `class_coordinator` or `view_coordinator`. Cross-Class Collection Assistant is **NOT** a fourth primary role.
>   - **Class Coordinator**: Assigned to a specific class with standard class permissions (`canView`, `canViewStudents`, `canAddPayment`, `canAddInstallment`, `canEditPayment`, `canViewReports`).
>   - **View Coordinator**: Viewer scope (`whole_event` or `specific_class`) with viewer-specific permissions (`canViewAggregate`, `canViewStudentCollectionStatus`, `canViewExpenses`, `canViewExpenseCategories`).
>   - **Cross-Class Collection Assistant**: An independent capability configured separately with its own authorized classes and discrete capability toggles (`canViewCollection`, `canAddPayment`, `canAddInstallment`, `canHandlePendingApprovals`, `canAccessCentralReceipts`). Enabling Cross-Class Assistant **never** automatically grants Class Coordinator or View Coordinator permissions.
> - **Full Preservation of Existing "Edit Access" & Permissions**: The existing Coordinator Management page, `Edit Access` modal, real-time `onSnapshot` listeners, permission toggles, viewer scopes, Cross-Class Collection Assistant capabilities, and Central Receipts access remain 100% functional and intact.

---

## Architecture Overview

```
Super Coordinator Browser
         │
         ▼
EKCTC Finance Web App (CoordinatorsPage.tsx)
         │
         ├── Check Account / Onboard Action (Exclusively via Cloud Functions)
         │
         ▼
Firebase Callable Cloud Function (functions/index.js)
  • checkCoordinatorAuth (Email lookup)
  • onboardCoordinator (Auth creation & Firestore provisioning)
         │
         ├── Authenticates caller is active Super Coordinator
         ├── Uses Firebase Admin SDK
         │
         ├──► Firebase Authentication
         │     • Existing user: READ-ONLY (gets UID; never touches Auth password/status)
         │     • New user: Creates Auth account (email, password, displayName)
         │
         ├──► Firestore `users/{uid}` (profile creation/update)
         ├──► Firestore `coordinatorAssignments/{uid}_{eventId}` (assignment setup)
         └──► Firestore `auditLogs` (immutable audit record)
```

---

## Proposed Changes

### 1. Secure Backend Cloud Functions

#### [NEW] [functions/package.json](file:///c:/Users/shibi/OneDrive/Desktop/college%20finance%20web/functions/package.json)
- Define supported Node.js 20 LTS runtime (Node 18 is EOL and deprecated for Cloud Functions):
  ```json
  {
    "name": "functions",
    "scripts": {
      "deploy": "firebase deploy --only functions"
    },
    "engines": {
      "node": "20"
    },
    "main": "index.js",
    "dependencies": {
      "firebase-admin": "^12.7.0",
      "firebase-functions": "^6.0.1"
    }
  }
  ```

#### [NEW] [functions/index.js](file:///c:/Users/shibi/OneDrive/Desktop/college%20finance%20web/functions/index.js)
- Implement two HTTPS Callable Cloud Functions (`onCall`):
  1. `checkCoordinatorAuth`:
     - Verifies caller token & checks `users/{callerUid}` in Firestore to guarantee caller is an active `super_coordinator`.
     - Calls `admin.auth().getUserByEmail(email)`.
     - Returns `{ exists: true, uid, email, displayName, disabled, hasFirestoreProfile, hasEventAssignment }` if found.
     - Returns `{ exists: false }` if `auth/user-not-found`.
  2. `onboardCoordinator`:
     - Verifies caller is active `super_coordinator`.
     - **For Existing Auth User**:
       - Retrieves existing UID (`userRecord.uid`).
       - **Strictly preserves** the existing Firebase Auth account: does **NOT** call `updateUser`, does **NOT** change password, does **NOT** modify email or disabled state in Auth.
       - Sets `isExistingAuthUser = true`.
     - **For New User**:
       - Validates password (min 6 characters).
       - Calls `admin.auth().createUser({ email, password, displayName: name, disabled: !accountActive })`.
       - Sets `isExistingAuthUser = false`.
     - **Firestore Profile & Assignment**:
       - Creates or updates `users/{uid}` with: `name`, `email`, `role`, `active`, `loginEnabled`, timestamps.
       - Creates or updates `coordinatorAssignments/{uid}_{eventId}` using deterministic doc ID `${uid}_${eventId}`.
       - Records immutable audit log entry in `auditLogs` (`action: "COORDINATOR_ONBOARDED"` or `"COORDINATOR_LINKED"`).
       - Returns `{ success: true, uid, isExistingAuthUser, message }`.

#### [MODIFY] [firebase.json](file:///c:/Users/shibi/OneDrive/Desktop/college%20finance%20web/firebase.json)
- Add `functions` section pointing to `functions` directory with deploy settings and ignore rules.

---

### 2. Client Firebase Functions & Onboarding Service

#### [NEW] [src/firebase/functions.ts](file:///c:/Users/shibi/OneDrive/Desktop/college%20finance%20web/src/firebase/functions.ts)
- Initialize and export Firebase Functions client:
  ```typescript
  import { getFunctions } from "firebase/functions";
  import { firebaseApp } from "./config";
  export const functions = getFunctions(firebaseApp, "asia-south2");
  ```

#### [NEW] [src/services/coordinatorOnboardingService.ts](file:///c:/Users/shibi/OneDrive/Desktop/college%20finance%20web/src/services/coordinatorOnboardingService.ts)
- Client-side service calling `checkCoordinatorAuth` and `onboardCoordinator` strictly through `httpsCallable`.
- Provides clean TypeScript interfaces: `CheckCoordinatorResult`, `OnboardCoordinatorParams`, `OnboardCoordinatorResult`.
- **NO client-side fallback**: If Cloud Functions are unavailable or fail, surfaces clear user-friendly diagnostic errors (e.g. informing that the Cloud Function needs deployment via `firebase deploy --only functions` or network connectivity issues), without executing client-side fallbacks.

---

### 3. Add Coordinator Workflow UI

#### [MODIFY] [CoordinatorsPage.tsx](file:///c:/Users/shibi/OneDrive/Desktop/college%20finance%20web/src/pages/super/CoordinatorsPage.tsx)
- Add prominent `+ Add Coordinator` button in the header bar alongside `Assign / Configure Coordinator`.
- Build comprehensive **Add Coordinator Modal**:
  1. **Account Detection Bar**:
     - Email input with `Check Existing Firebase Account` button (and automatic check on blur).
     - Detection Banner:
       - **Existing Account Found**: Green badge with check icon, displays existing UID, status (`Active` / `Disabled`), and clear reassurance: *"Existing Firebase Authentication account found. Existing password, email, and Auth status will remain untouched. No password required."*
       - **New Account**: Blue badge, displays Password field with toggle visibility and minimum 6-character requirement.
       - **Existing Firestore User Found**: Informs the Super Coordinator that profile already exists and will be linked/updated.
       - **Existing Assignment Found**: Displays existing assignment details and offers to update rather than duplicate.
  2. **Account Details**:
     - Full Name input (auto-populated if existing displayName exists).
     - Primary Role Selection (Strictly `class_coordinator` or `view_coordinator`).
     - Initial Firestore Profile Status (Active vs. Disabled) and Login Enabled toggles.
  3. **Assignment & Permissions Configuration (Strictly Separated Roles & Capabilities)**:
     - **Class Coordinator**:
       - Assigned Class selector.
       - Discrete Class Permissions (`canView`, `canViewStudents`, `canAddPayment`, `canAddInstallment`, `canEditPayment`, `canViewReports`).
     - **View Coordinator**:
       - Scope selector (`whole_event` or `specific_class` with class picker).
       - Discrete Viewer Permissions (`canViewAggregate`, `canViewStudentCollectionStatus`, `canViewExpenses`, `canViewExpenseCategories`).
     - **Cross-Class Collection Assistant**:
       - Distinct capability toggle (`[ ] Enable Cross-Class Collection Assistant`).
       - Authorized classes multi-select chips.
       - Granular assistant capabilities (`canViewCollection`, `canAddPayment`, `canAddInstallment`, `canHandlePendingApprovals`, `canAccessCentralReceipts`).
       - Enabling assistant capability does **NOT** grant regular Class Coordinator or View Coordinator permissions.
  4. **Submission & Duplicate Protection**:
     - Validates inputs before sending.
     - Calls `onboardCoordinator` via Cloud Function.
     - Displays success toast/banner with account details.
     - Automatically refreshes users list and assignments in real-time.
- **Preserve Existing Functionality**:
  - Keep existing `openAssignModal` (`Edit Access` button) exactly as it currently works for editing existing coordinators.
  - Keep quick disable/enable toggles intact.

---

## Verification Plan

### Automated Tests
- `npm run lint`: Run ESLint to verify 0 errors and 0 warnings.
- `npm run build`: Run `tsc -b && vite build` to ensure TypeScript compilation and production bundle build succeed with 0 errors.

### Manual Verification
1. **Existing User Linking (No Auth Modification)**:
   - Enter an email of an existing Firebase Authentication user (e.g. `shibinnct@gmail.com` or another existing coordinator).
   - Verify that clicking "Check Existing Firebase Account" calls the Cloud Function, retrieves the UID, and disables the password field.
   - Verify that on submit, the existing Auth record is NOT modified in Firebase Auth.
2. **New User Creation**:
   - Enter a new unique test coordinator email (e.g. `coord_test_temp@example.com`).
   - Verify the password field is shown and validated (min 6 chars).
3. **Firestore & Assignment Linking**:
   - Save the coordinator.
   - Verify `users/{uid}` document is created with correct `name`, `email`, `role`, `active`, `loginEnabled`.
   - Verify `coordinatorAssignments/{uid}_{eventId}` is created with correct permissions.
4. **Audit Log Verification**:
   - Check Audit Center to confirm `COORDINATOR_ONBOARDED` / `COORDINATOR_LINKED` is logged with Super Coordinator identity and target details.
5. **Existing Edit Access Verification**:
   - Open existing coordinator and click `Edit Access`.
   - Change permissions and verify real-time updates propagate correctly.
