import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase/firestore";
import { COLLECTIONS } from "../firebase/collections";
import type { ClassModel, Department, UserProfile } from "../types";
import { logAudit } from "./auditService";

export async function fetchClasses(): Promise<ClassModel[]> {
  try {
    const classesRef = collection(db, COLLECTIONS.CLASSES);
    const q = query(classesRef, orderBy("displayName", "asc"));
    const snapshot = await getDocs(q);
    const list: ClassModel[] = [];
    snapshot.forEach((d) => {
      list.push({ id: d.id, ...(d.data() as Omit<ClassModel, "id">) });
    });
    return list;
  } catch (error) {
    console.error("Error fetching classes:", error);
    return [];
  }
}

export async function fetchClassById(id: string): Promise<ClassModel | null> {
  try {
    const ref = doc(db, COLLECTIONS.CLASSES, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<ClassModel, "id">) };
  } catch (error) {
    console.error(`Error fetching class ${id}:`, error);
    return null;
  }
}

export async function createClass(
  params: {
    displayName: string;
    department: Department | string;
    year: number;
    section: string;
  },
  user: UserProfile
): Promise<ClassModel> {
  const classesRef = collection(db, COLLECTIONS.CLASSES);
  const now = serverTimestamp();

  const docRef = await addDoc(classesRef, {
    displayName: params.displayName.trim(),
    department: params.department,
    year: Number(params.year),
    section: params.section.trim().toUpperCase(),
    active: true,
    createdAt: now,
    updatedAt: now,
  });

  await logAudit({
    userId: user.uid,
    userRole: user.role,
    userName: user.name,
    action: "create_class",
    category: "event_management",
    classId: docRef.id,
    description: `Created class "${params.displayName}" (${params.department} Year ${params.year})`,
  });

  return {
    id: docRef.id,
    displayName: params.displayName.trim(),
    department: params.department,
    year: Number(params.year),
    section: params.section.trim().toUpperCase(),
    active: true,
  };
}

export async function updateClass(
  id: string,
  updates: Partial<ClassModel>,
  user: UserProfile
): Promise<void> {
  const ref = doc(db, COLLECTIONS.CLASSES, id);
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  await logAudit({
    userId: user.uid,
    userRole: user.role,
    userName: user.name,
    action: "update_class",
    category: "event_management",
    classId: id,
    description: `Updated class details for ID ${id}`,
  });
}
