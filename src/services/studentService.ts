import {
  collection,
  doc,
  getDocs,
  setDoc,
  addDoc,
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
  EventModel,
  ClassModel,
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

/**
 * Single source of truth for active event collection calculations and participant resolution.
 * - Reconciles all active students in active classes with any existing event overrides.
 * - Automatically excludes inactive classes from active collection eligibility.
 * - Requires no manual opening of collection ledgers.
 */
export async function fetchEffectiveEventParticipants(
  event: EventModel,
  activeClasses?: ClassModel[]
): Promise<EventParticipantModel[]> {
  try {
    // 1. Fetch all active students in a single query
    const studentsRef = collection(db, COLLECTIONS.STUDENTS);
    const qStudents = query(studentsRef, where("active", "==", true));
    const studentsSnap = await getDocs(qStudents);
    const allStudents: StudentModel[] = [];
    studentsSnap.forEach((d) => {
      allStudents.push({ id: d.id, ...(d.data() as Omit<StudentModel, "id">) });
    });

    // 2. Resolve set of active class IDs
    let activeClassIds: Set<string>;
    if (activeClasses && activeClasses.length > 0) {
      activeClassIds = new Set(
        activeClasses.filter((c) => c.active !== false).map((c) => c.id)
      );
    } else {
      const classesRef = collection(db, COLLECTIONS.CLASSES);
      const classesSnap = await getDocs(classesRef);
      activeClassIds = new Set();
      classesSnap.forEach((d) => {
        const cData = d.data();
        if (cData.active !== false) {
          activeClassIds.add(d.id);
        }
      });
    }

    // 3. Filter students to only those belonging to active classes
    const eligibleStudents = allStudents.filter((s) => activeClassIds.has(s.classId));

    // 4. Fetch any existing stored event participants for this event
    const storedParticipants = await fetchEventParticipants(event.id);
    const storedMap = new Map<string, EventParticipantModel>();
    for (const p of storedParticipants) {
      // Inactive classes are strictly excluded from current active calculations
      if (activeClassIds.has(p.classId)) {
        storedMap.set(p.studentId, p);
      }
    }

    // 5. Build full reconciled participant list for all eligible students
    const result: EventParticipantModel[] = [];
    for (const student of eligibleStudents) {
      if (storedMap.has(student.id)) {
        result.push(storedMap.get(student.id)!);
      } else {
        result.push({
          id: `ep_${event.id}_${student.id}`,
          eventId: event.id,
          studentId: student.id,
          classId: student.classId,
          participationStatus: "eligible",
          requiredAmount: event.targetAmountEnabled ? (event.defaultTargetAmount || 0) : 0,
          targetAmountEnabled: event.targetAmountEnabled,
          exemption: false,
          coordinatorWaiver: false,
        });
      }
    }

    return result;
  } catch (error) {
    console.error("Error fetching effective event participants:", error);
    return [];
  }
}

export async function setExemption(
  participantId: string,
  isExempted: boolean,
  reason: string,
  user: UserProfile,
  context?: Partial<EventParticipantModel>
): Promise<void> {
  const ref = doc(db, COLLECTIONS.EVENT_PARTICIPANTS, participantId);
  const status: ParticipationStatus = isExempted ? "exempted" : "eligible";

  const data: Record<string, any> = {
    participationStatus: status,
    exemption: isExempted,
    exemptionReason: isExempted ? reason : "",
    exemptedBy: isExempted ? user.uid : null,
    exemptedAt: isExempted ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  };

  if (context) {
    if (context.eventId) data.eventId = context.eventId;
    if (context.studentId) data.studentId = context.studentId;
    if (context.classId) data.classId = context.classId;
    if (context.requiredAmount !== undefined) data.requiredAmount = context.requiredAmount;
    if (context.targetAmountEnabled !== undefined) data.targetAmountEnabled = context.targetAmountEnabled;
  }

  await setDoc(ref, data, { merge: true });

  await logAudit({
    userId: user.uid,
    userRole: user.role,
    userName: user.name,
    action: isExempted ? "create_exemption" : "remove_exemption",
    category: "exemption",
    eventId: context?.eventId,
    classId: context?.classId,
    studentId: context?.studentId,
    description: isExempted
      ? `Exempted student (Participant ${participantId}). Reason: ${reason}`
      : `Removed exemption for student (Participant ${participantId})`,
  });
}

export async function setCoordinatorWaiver(
  participantId: string,
  isWaived: boolean,
  waiverAmount: number,
  user: UserProfile,
  context?: Partial<EventParticipantModel>
): Promise<void> {
  const ref = doc(db, COLLECTIONS.EVENT_PARTICIPANTS, participantId);

  const data: Record<string, any> = {
    coordinatorWaiver: isWaived,
    coordinatorWaiverAmount: isWaived ? waiverAmount : 0,
    coordinatorWaiverBy: isWaived ? user.uid : null,
    coordinatorWaiverAt: isWaived ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  };

  if (context) {
    if (context.eventId) data.eventId = context.eventId;
    if (context.studentId) data.studentId = context.studentId;
    if (context.classId) data.classId = context.classId;
    if (context.requiredAmount !== undefined) data.requiredAmount = context.requiredAmount;
    if (context.targetAmountEnabled !== undefined) data.targetAmountEnabled = context.targetAmountEnabled;
  }

  await setDoc(ref, data, { merge: true });

  await logAudit({
    userId: user.uid,
    userRole: user.role,
    userName: user.name,
    action: isWaived ? "create_coordinator_waiver" : "remove_coordinator_waiver",
    category: "coordinator_waiver",
    eventId: context?.eventId,
    classId: context?.classId,
    studentId: context?.studentId,
    amount: isWaived ? waiverAmount : 0,
    description: isWaived
      ? `Applied Coordinator Waiver of ₹${waiverAmount} to Participant ${participantId}`
      : `Removed Coordinator Waiver for Participant ${participantId}`,
  });
}
