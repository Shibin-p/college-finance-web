import type { VercelRequest, VercelResponse } from "@vercel/node";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore, verifyCentralReceiptAccessCaller } from "./_lib/firebaseAdmin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST", "OPTIONS"]);
    return res.status(405).json({ success: false, error: "Method Not Allowed. Use POST." });
  }

  try {
    const {
      eventId,
      classId,
      totalAmount,
      cashAmount = 0,
      digitalAmount = 0,
      otherAmount = 0,
      date,
      time,
      remarks = "",
      assignmentId,
    } = req.body || {};

    if (!eventId || !classId || !date) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: eventId, classId, and date are required.",
      });
    }

    const numTotal = Number(totalAmount);
    const numCash = Number(cashAmount);
    const numDigital = Number(digitalAmount);
    const numOther = Number(otherAmount);

    if (isNaN(numTotal) || numTotal <= 0) {
      return res.status(400).json({ success: false, error: "Total amount must be greater than 0." });
    }

    if (numCash + numDigital + numOther !== numTotal) {
      return res.status(400).json({
        success: false,
        error: `Discrepancy: Cash (₹${numCash}) + Digital (₹${numDigital}) + Other (₹${numOther}) does not match Total Amount (₹${numTotal}).`,
      });
    }

    // 1. Authenticate caller and verify server-side Central Receipts permissions
    const caller = await verifyCentralReceiptAccessCaller(req, eventId);

    const firestore = getAdminFirestore();

    // 2. Prepare receipt payload with server-determined actor
    const currentTimeStr =
      time ||
      new Date().toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
      });

    const receiptData: Record<string, any> = {
      eventId,
      classId,
      totalAmount: numTotal,
      cashAmount: numCash,
      digitalAmount: numDigital,
      otherAmount: numOther,
      date,
      time: currentTimeStr,
      receivedBy: caller.uid,
      receivedByName: caller.name,
      receivedByRole: caller.roleTitle,
      remarks: String(remarks || "").trim(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (assignmentId) {
      receiptData.assignmentId = assignmentId;
    }

    const docRef = await firestore.collection("centralReceipts").add(receiptData);

    // 3. Write verified immutable audit log
    await firestore.collection("auditLogs").add({
      userId: caller.uid,
      userRole: caller.roleTitle,
      userName: caller.name,
      action: "CENTRAL_RECEIPT_CREATED",
      category: "central_receipt",
      eventId,
      classId,
      receiptId: docRef.id,
      amount: numTotal,
      description: `Recorded central receipt of ₹${numTotal} (Cash: ₹${numCash}, Digital: ₹${numDigital}) by ${caller.name} (${caller.roleTitle})`,
      timestamp: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      receipt: {
        id: docRef.id,
        ...receiptData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error("[create-central-receipt] Error:", err);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: err.message || "Failed to record central receipt.",
    });
  }
}
