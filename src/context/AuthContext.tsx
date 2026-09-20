import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import {
  auth,
  loginWithEmailPassword,
  logoutUser,
  onAuthStateChanged,
  type FirebaseUser,
} from "../firebase/auth";
import { db } from "../firebase/firestore";
import { COLLECTIONS } from "../firebase/collections";
import type { UserProfile } from "../types";
import { logAudit } from "../services/auditService";

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfileDirect = async (uid: string): Promise<UserProfile | null> => {
    try {
      const userRef = doc(db, COLLECTIONS.USERS, uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          uid,
          name: data.name || "User",
          email: data.email || "",
          role: data.role || "view_coordinator",
          active: data.active ?? true,
          loginEnabled: data.loginEnabled ?? true,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      }
      return null;
    } catch (err: any) {
      console.error(`Error reading users/${uid}:`, err);
      throw new Error(err.message || "Failed to load user profile.", { cause: err });
    }
  };

  useEffect(() => {
    let profileUnsub: (() => void) | null = null;

    const authUnsub = onAuthStateChanged(auth, (user) => {
      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }

      setLoading(true);
      setError(null);

      if (user) {
        setCurrentUser(user);
        const userRef = doc(db, COLLECTIONS.USERS, user.uid);

        // Real-time listener for user profile updates
        profileUnsub = onSnapshot(
          userRef,
          async (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              const profile: UserProfile = {
                uid: user.uid,
                name: data.name || "User",
                email: data.email || user.email || "",
                role: data.role || "view_coordinator",
                active: data.active ?? true,
                loginEnabled: data.loginEnabled ?? true,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
              };

              if (!profile.active || !profile.loginEnabled) {
                await logoutUser();
                setCurrentUser(null);
                setUserProfile(null);
                setError("Your account is currently disabled. Please contact the Super Coordinator.");
                setLoading(false);
                return;
              }

              setUserProfile(profile);
            } else {
              setUserProfile(null);
            }
            setLoading(false);
          },
          (err) => {
            console.error("User profile onSnapshot error:", err);
            setUserProfile(null);
            setLoading(false);
          }
        );
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      authUnsub();
      if (profileUnsub) profileUnsub();
    };
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    setError(null);
    try {
      const credential = await loginWithEmailPassword(email, pass);
      const user = credential.user;

      let profile: UserProfile | null = null;
      try {
        profile = await fetchProfileDirect(user.uid);
      } catch (err: any) {
        await logoutUser();
        throw new Error(`Profile access error: ${err.message}`, { cause: err });
      }

      if (!profile) {
        await logoutUser();
        throw new Error(
          `User record not found in system database (Auth UID: ${user.uid}). Please contact the Super Coordinator.`
        );
      }

      if (!profile.active || !profile.loginEnabled) {
        await logoutUser();
        throw new Error("Your account has been deactivated. Please contact the Super Coordinator.");
      }

      setCurrentUser(user);
      setUserProfile(profile);

      try {
        await logAudit({
          userId: profile.uid,
          userRole: profile.role,
          userName: profile.name,
          action: "login_success",
          category: "login",
          description: `User ${profile.name} logged in successfully`,
        });
      } catch (auditErr) {
        console.warn("Could not write login audit log:", auditErr);
      }
    } catch (err: any) {
      console.error("Login failed:", err);
      let msg = "Invalid email or password.";
      const rawMsg = String(err?.message || "");
      const errCode = String(err?.code || "");

      // Preserve explicit account state messages
      if (rawMsg.includes("deactivated") || rawMsg.includes("disabled")) {
        msg = "Your account has been deactivated. Please contact the Super Coordinator.";
      } else if (
        errCode === "auth/invalid-credential" ||
        errCode === "auth/user-not-found" ||
        errCode === "auth/wrong-password" ||
        errCode === "auth/invalid-email" ||
        rawMsg.includes("auth/") ||
        rawMsg.includes("Firebase:") ||
        rawMsg.includes("credential") ||
        rawMsg.includes("User record not found")
      ) {
        msg = "Invalid email or password.";
      } else if (rawMsg && !rawMsg.includes("Firebase") && !rawMsg.includes("auth/")) {
        msg = rawMsg;
      }
      setError(msg);
      throw new Error(msg, { cause: err });
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (userProfile) {
      try {
        await logAudit({
          userId: userProfile.uid,
          userRole: userProfile.role,
          userName: userProfile.name,
          action: "logout",
          category: "logout",
          description: `User ${userProfile.name} logged out`,
        });
      } catch (auditErr) {
        console.warn("Could not write logout audit log:", auditErr);
      }
    }
    await logoutUser();
    setCurrentUser(null);
    setUserProfile(null);
  };

  const refreshProfile = async () => {
    if (currentUser) {
      try {
        const p = await fetchProfileDirect(currentUser.uid);
        if (p) setUserProfile(p);
      } catch (err) {
        console.error("Error refreshing profile:", err);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        error,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
