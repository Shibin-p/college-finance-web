import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase/firestore";
import { COLLECTIONS } from "../firebase/collections";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  type ExpenseCategory,
  type ExpenseCategoryConfig,
  type ExpenseModel,
  type EventModel,
  type UserProfile,
} from "../types";
import { logAudit } from "./auditService";

export interface CreateExpenseParams {
  eventId: string;
  category: ExpenseCategory;
  item: string;
  amount: number;
  remarks?: string;
}

/**
 * Returns all active and custom categories configured for an event, merging default categories.
 */
export function getEventExpenseCategories(
  event?: EventModel | null
): ExpenseCategoryConfig[] {
  const custom = event?.customExpenseCategories || [];
  // Merge defaults with custom
  const customIds = new Set(custom.map((c) => c.id));
  const defaults = DEFAULT_EXPENSE_CATEGORIES.filter((d) => !customIds.has(d.id));
  return [...defaults, ...custom];
}

/**
 * Adds a new custom expense category to an event.
 */
export async function addCustomExpenseCategory(
  eventId: string,
  category: { name: string; description?: string },
  user: UserProfile,
  existingCustom: ExpenseCategoryConfig[] = []
): Promise<ExpenseCategoryConfig> {
  const trimmedName = category.name.trim();
  if (!trimmedName) {
    throw new Error("Category name is required.");
  }

  // Check duplicate
  const allCurrent = [...DEFAULT_EXPENSE_CATEGORIES, ...existingCustom];
  if (allCurrent.some((c) => c.name.toLowerCase() === trimmedName.toLowerCase())) {
    throw new Error(`Category "${trimmedName}" already exists for this event.`);
  }

  const newCat: ExpenseCategoryConfig = {
    id: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: trimmedName,
    description: category.description?.trim() || "",
    active: true,
    isDefault: false,
  };

  const updatedCategories = [...existingCustom, newCat];
  const eventRef = doc(db, COLLECTIONS.EVENTS, eventId);
  await updateDoc(eventRef, {
    customExpenseCategories: updatedCategories,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });

  await logAudit({
    userId: user.uid,
    userRole: user.role,
    userName: user.name,
    action: "create_expense_category",
    category: "expense_category",
    eventId,
    description: `Created custom expense category "${trimmedName}"`,
    metadata: { category: newCat },
  });

  return newCat;
}

/**
 * Updates an existing custom expense category.
 */
export async function updateCustomExpenseCategory(
  eventId: string,
  categoryId: string,
  updates: { name?: string; description?: string; active?: boolean },
  user: UserProfile,
  existingCustom: ExpenseCategoryConfig[] = []
): Promise<ExpenseCategoryConfig[]> {
  const isDefault = DEFAULT_EXPENSE_CATEGORIES.some((d) => d.id === categoryId);

  let updatedList: ExpenseCategoryConfig[];
  if (isDefault) {
    // If it's a default category being toggled/overridden, add it to custom list with new status
    const def = DEFAULT_EXPENSE_CATEGORIES.find((d) => d.id === categoryId)!;
    const existing = existingCustom.find((c) => c.id === categoryId);
    if (existing) {
      updatedList = existingCustom.map((c) => (c.id === categoryId ? { ...c, ...updates } : c));
    } else {
      updatedList = [...existingCustom, { ...def, ...updates }];
    }
  } else {
    updatedList = existingCustom.map((c) => (c.id === categoryId ? { ...c, ...updates } : c));
  }

  const eventRef = doc(db, COLLECTIONS.EVENTS, eventId);
  await updateDoc(eventRef, {
    customExpenseCategories: updatedList,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });

  await logAudit({
    userId: user.uid,
    userRole: user.role,
    userName: user.name,
    action: "edit_expense_category",
    category: "expense_category",
    eventId,
    description: `Updated expense category (${categoryId}): ${JSON.stringify(updates)}`,
    metadata: { categoryId, updates },
  });

  return updatedList;
}

/**
 * Toggles active/inactive status of an expense category.
 */
export async function toggleCustomExpenseCategory(
  eventId: string,
  categoryId: string,
  active: boolean,
  user: UserProfile,
  existingCustom: ExpenseCategoryConfig[] = []
): Promise<ExpenseCategoryConfig[]> {
  return updateCustomExpenseCategory(
    eventId,
    categoryId,
    { active },
    user,
    existingCustom
  );
}

export async function createExpense(
  params: CreateExpenseParams,
  user: UserProfile
): Promise<ExpenseModel> {
  if (params.amount <= 0) {
    throw new Error("Expense amount must be greater than 0");
  }

  const ref = collection(db, COLLECTIONS.EXPENSES);
  const now = serverTimestamp();

  const data: Record<string, any> = {
    eventId: params.eventId,
    category: params.category,
    item: params.item.trim(),
    amount: Number(params.amount),
    remarks: params.remarks?.trim() || "",
    addedBy: user.uid,
    addedByName: user.name,
    createdAt: now,
    updatedAt: now,
    status: "active",
  };

  const docRef = await addDoc(ref, data);

  await logAudit({
    userId: user.uid,
    userRole: user.role,
    userName: user.name,
    action: "create_expense",
    category: "expense",
    eventId: params.eventId,
    expenseId: docRef.id,
    amount: params.amount,
    description: `Added expense "${params.item}" (₹${params.amount}, Category: ${params.category})`,
  });

  return {
    id: docRef.id,
    ...data,
  } as ExpenseModel;
}

export async function reverseExpense(
  expenseId: string,
  reason: string,
  user: UserProfile
): Promise<void> {
  const ref = doc(db, COLLECTIONS.EXPENSES, expenseId);
  const now = serverTimestamp();

  const snap = await getDoc(ref);
  const data = snap.data();

  await updateDoc(ref, {
    status: "reversed",
    updatedAt: now,
  });

  await logAudit({
    userId: user.uid,
    userRole: user.role,
    userName: user.name,
    action: "reverse_expense",
    category: "expense",
    eventId: data?.eventId,
    expenseId,
    amount: data?.amount,
    description: `Reversed expense ${expenseId} (${data?.item || "item"}). Reason: ${reason || "None specified"}`,
  });
}

export async function fetchExpenses(eventId: string): Promise<ExpenseModel[]> {
  try {
    const ref = collection(db, COLLECTIONS.EXPENSES);
    const q = query(ref, where("eventId", "==", eventId));
    const snap = await getDocs(q);
    const list: ExpenseModel[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...(d.data() as Omit<ExpenseModel, "id">) });
    });
    return list.sort((a, b) => {
      const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  } catch (error) {
    console.error(`Error fetching expenses for event ${eventId}:`, error);
    return [];
  }
}
