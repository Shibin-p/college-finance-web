import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminFirestore, verifyCentralReceiptAccessCaller } from "./_lib/firebaseAdmin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET", "OPTIONS"]);
    return res.status(405).json({ success: false, error: "Method Not Allowed. Use GET." });
  }

  try {
    const eventId = String(req.query.eventId || "");
    const classId = req.query.classId ? String(req.query.classId) : undefined;

    if (!eventId) {
      return res.status(400).json({ success: false, error: "Missing required query param: eventId" });
    }

    // Server-side authorization check for Super Coordinator or authorized Cross-Class Assistant
    await verifyCentralReceiptAccessCaller(req, eventId);

    const firestore = getAdminFirestore();
    let q: FirebaseFirestore.Query = firestore.collection("centralReceipts").where("eventId", "==", eventId);

    if (classId && classId !== "all") {
      q = q.where("classId", "==", classId);
    }

    const snap = await q.get();
    const receipts: any[] = [];

    snap.forEach((doc) => {
      const data = doc.data();
      receipts.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      });
    });

    receipts.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    return res.status(200).json({
      success: true,
      receipts,
    });
  } catch (err: any) {
    console.error("[get-central-receipts] Error:", err);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: err.message || "Failed to fetch central receipts.",
    });
  }
}
