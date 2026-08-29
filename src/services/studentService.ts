import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/firestore";
import { COLLECTIONS } from "../firebase/collections";
import type {
  StudentModel,
  EventParticipantModel,
  UserProfile,
  ParticipationStatus,
} from "../types";
import { logAudit } from "./auditService";

export async function fetchStudentsByClass(classId: string): Promise<StudentModel[]> {
  try {
    const ref = collection(db, COLLECTIONS.STUDENTS);
    const q = query(ref, where("classId", "==", classId), where("active", "==", true));
    const snap = await getDocs(q);
    const list: StudentModel[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...(d.data() as Omit<StudentModel, "id">) });
    });
    return list.sort((a, b) => a.registerNumber.localeCompare(b.registerNumber));
  } catch (error) {
    console.error(`Error fetching students for class ${classId}:`, error);
    return [];
  }
}

export async function fetchAllStudents(): Promise<StudentModel[]> {
  try {
    const ref = collection(db, COLLECTIONS.STUDENTS);
    const snap = await getDocs(ref);
    const list: StudentModel[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...(d.data() as Omit<StudentModel, "id">) });
    });
    return list;
  } catch (error) {
    console.error("Error fetching all students:", error);
    return [];
  }
}

export async function createStudent(
  params: {
    name: string;
    registerNumber: string;
    classId: string;
    department: string;
    year: number;
  },
  user: UserProfile
): Promise<StudentModel> {
  const ref = collection(db, COLLECTIONS.STUDENTS);
  const now = serverTimestamp();

  const docRef = await addDoc(ref, {
    name: params.name.trim(),
    registerNumber: params.registerNumber.trim().toUpperCase(),
    classId: params.classId,
    department: params.department,
    year: params.year,
    active: true,
    createdAt: now,
    updatedAt: now,
  });

  await logAudit({
    userId: user.uid,
    userRole: user.role,
    userName: user.name,
    action: "create_student",
    category: "student_management",
    classId: params.classId,
    studentId: docRef.id,
    description: `Added student ${params.name} (${params.registerNumber})`,
  });

  return {
    id: docRef.id,
    name: params.name.trim(),
    registerNumber: params.registerNumber.trim().toUpperCase(),
    classId: params.classId,
    department: params.department,
    year: params.year,
    active: true,
  };
}

export async function bulkImportStudents(
  students: Array<{ name: string; registerNumber: string }>,
  classDetails: { classId: string; department: string; year: number },
  user: UserProfile
): Promise<{ added: number; errors: string[] }> {
  const batchSize = 400;
  let added = 0;
  const errors: string[] = [];

  for (let i = 0; i < students.length; i += batchSize) {
    const chunk = students.slice(i, i + batchSize);
    const batch = writeBatch(db);

    for (const item of chunk) {
      const studentDocRef = doc(collection(db, COLLECTIONS.STUDENTS));
      batch.set(studentDocRef, {
        name: item.name.trim(),
        registerNumber: item.registerNumber.trim().toUpperCase(),
        classId: classDetails.classId,
        department: classDetails.department,
        year: classDetails.year,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      added++;
    }

    try {
      await batch.commit();
    } catch (e: any) {
      console.error("Batch write failed", e);
      errors.push(e.message || "Failed writing chunk");
    }
  }

  await logAudit({
    userId: user.uid,
    userRole: user.role,
    userName: user.name,
    action: "bulk_import_students",
    category: "student_management",
    classId: classDetails.classId,
    description: `Bulk imported ${added} students into class ID ${classDetails.classId}`,
  });

  return { added, errors };
}

export async function fetchEventParticipants(
  eventId: string,
  classId?: string
): Promise<EventParticipantModel[]> {
  try {
    const ref = collection(db, COLLECTIONS.EVENT_PARTICIPANTS);
    let q = query(ref, where("eventId", "==", eventId));
    if (classId) {
      q = query(ref, where("eventId", "==", eventId), where("classId", "==", classId));
    }
    const snap = await getDocs(q);
    const list: EventParticipantModel[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...(d.data() as Omit<EventParticipantModel, "id">) });
    });
    return list;
  } catch (error) {
    console.error(`Error fetching event participants for event ${eventId}:`, error);
    return [];
  }
}

export async function ensureEventParticipantsForClass(
  eventId: string,
  classId: string,
  defaultTargetAmount: number,
  targetAmountEnabled: boolean,
  students: StudentModel[]
): Promise<EventParticipantModel[]> {
  const existing = await fetchEventParticipants(eventId, classId);
  const existingByStudent = new Set(existing.map((p) => p.studentId));

  const missingStudents = students.filter((s) => !existingByStudent.has(s.id));
  if (missingStudents.length === 0) {
    return existing;
  }

  const batch = writeBatch(db);
  const newParticipants: EventParticipantModel[] = [];

  for (const s of missingStudents) {
    const partRef = doc(collection(db, COLLECTIONS.EVENT_PARTICIPANTS));
    const data: Omit<EventParticipantModel, "id"> = {
      eventId,
      studentId: s.id,
      classId: s.classId,
      participationStatus: "eligible",
      requiredAmount: targetAmountEnabled ? defaultTargetAmount : 0,
      targetAmountEnabled,
      exemption: false,
      coordinatorWaiver: false,
    };
    batch.set(partRef, data);
    newParticipants.push({ id: partRef.id, ...data });
  }

  await batch.commit();
  return [...existing, ...newParticipants];
}

export async function setExemption(
  participantId: string,
  isExempted: boolean,
  reason: string,
  user: UserProfile
): Promise<void> {
  const ref = doc(db, COLLECTIONS.EVENT_PARTICIPANTS, participantId);
  const status: ParticipationStatus = isExempted ? "exempted" : "eligible";

  await updateDoc(ref, {
    participationStatus: status,
    exemption: isExempted,
    exemptionReason: isExempted ? reason : "",
    exemptedBy: isExempted ? user.uid : null,
    exemptedAt: isExempted ? serverTimestamp() : null,
  });

  await logAudit({
    userId: user.uid,
    userRole: user.role,
    userName: user.name,
    action: isExempted ? "create_exemption" : "remove_exemption",
    category: "exemption",
    description: isExempted
      ? `Exempted student (Participant ${participantId}). Reason: ${reason}`
      : `Removed exemption for student (Participant ${participantId})`,
  });
}

export async function setCoordinatorWaiver(
  participantId: string,
  isWaived: boolean,
  waiverAmount: number,
  user: UserProfile
): Promise<void> {
  const ref = doc(db, COLLECTIONS.EVENT_PARTICIPANTS, participantId);

  await updateDoc(ref, {
    coordinatorWaiver: isWaived,
    coordinatorWaiverAmount: isWaived ? waiverAmount : 0,
    coordinatorWaiverBy: isWaived ? user.uid : null,
    coordinatorWaiverAt: isWaived ? serverTimestamp() : null,
  });

  await logAudit({
    userId: user.uid,
    userRole: user.role,
    userName: user.name,
    action: isWaived ? "create_coordinator_waiver" : "remove_coordinator_waiver",
    category: "coordinator_waiver",
    amount: isWaived ? waiverAmount : 0,
    description: isWaived
      ? `Applied Coordinator Waiver of ₹${waiverAmount} to Participant ${participantId}`
      : `Removed Coordinator Waiver for Participant ${participantId}`,
  });
}
