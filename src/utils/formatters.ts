/**
 * Currency and date formatting utilities for EKCTC Finance
 */

export function formatINR(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return "₹0";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: any): string {
  if (!date) return "—";

  try {
    let d: Date;
    if (typeof date === "string") {
      d = new Date(date);
    } else if (date.toDate && typeof date.toDate === "function") {
      d = date.toDate();
    } else if (date.seconds) {
      d = new Date(date.seconds * 1000);
    } else if (date instanceof Date) {
      d = date;
    } else {
      d = new Date(date);
    }

    if (isNaN(d.getTime())) return "—";

    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function formatDateTime(date: any): string {
  if (!date) return "—";

  try {
    let d: Date;
    if (typeof date === "string") {
      d = new Date(date);
    } else if (date.toDate && typeof date.toDate === "function") {
      d = date.toDate();
    } else if (date.seconds) {
      d = new Date(date.seconds * 1000);
    } else if (date instanceof Date) {
      d = date;
    } else {
      d = new Date(date);
    }

    if (isNaN(d.getTime())) return "—";

    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "—";
  }
}

export function getTodayDateString(): string {
  const d = new Date();
  return getISTDateString(d);
}

/**
 * Returns YYYY-MM-DD string in Asia/Kolkata timezone from any date/timestamp representation.
 */
export function getISTDateString(timestamp: any): string {
  if (!timestamp) return "";
  try {
    let dateObj: Date | null = null;
    if (typeof timestamp.toDate === "function") {
      dateObj = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      dateObj = timestamp;
    } else if (typeof timestamp === "string") {
      dateObj = new Date(timestamp);
    } else if (typeof timestamp === "number") {
      dateObj = new Date(timestamp);
    } else if (timestamp.seconds) {
      dateObj = new Date(timestamp.seconds * 1000);
    }
    if (!dateObj || isNaN(dateObj.getTime())) return "";

    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dateObj);
  } catch {
    return "";
  }
}

/**
 * Formats a YYYY-MM-DD string into readable "DD MMM YYYY" in IST.
 */
export function formatISTDisplayDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
    return formatDate(dateStr);
  } catch {
    return dateStr;
  }
}
