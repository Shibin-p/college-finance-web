/**
 * Validation utilities
 */

export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function sanitizeAmount(input: any): number {
  if (typeof input === "number") {
    return isNaN(input) || input < 0 ? 0 : input;
  }
  if (typeof input === "string") {
    const parsed = parseFloat(input.replace(/[^\d.]/g, ""));
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }
  return 0;
}

export interface StudentImportRow {
  registerNumber: string;
  name: string;
  department?: string;
  year?: number;
  classId?: string;
  isValid: boolean;
  errors: string[];
}

export interface ParseResult {
  totalRows: number;
  validRows: StudentImportRow[];
  invalidRows: StudentImportRow[];
  duplicateRegisterNumbers: string[];
}

export function validateStudentImportData(
  rawData: Array<Record<string, any>>,
  existingRegisterNumbers: Set<string>
): ParseResult {
  const validRows: StudentImportRow[] = [];
  const invalidRows: StudentImportRow[] = [];
  const seenInBatch = new Set<string>();
  const duplicateRegisterNumbers: string[] = [];

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    // Find keys regardless of case or spaces
    const regKey = Object.keys(row).find((k) =>
      /register(\s*no|\s*number)?|reg(\s*no)?/i.test(k.trim())
    );
    const nameKey = Object.keys(row).find((k) =>
      /name|student(\s*name)?/i.test(k.trim())
    );

    const rawReg = regKey ? String(row[regKey] || "").trim() : "";
    const rawName = nameKey ? String(row[nameKey] || "").trim() : "";

    const errors: string[] = [];

    if (!rawReg) {
      errors.push("Missing register number");
    }
    if (!rawName) {
      errors.push("Missing student name");
    }

    if (rawReg) {
      if (seenInBatch.has(rawReg.toUpperCase())) {
        errors.push("Duplicate register number in this file");
        if (!duplicateRegisterNumbers.includes(rawReg)) {
          duplicateRegisterNumbers.push(rawReg);
        }
      } else if (existingRegisterNumbers.has(rawReg.toUpperCase())) {
        errors.push("Register number already exists in database");
        if (!duplicateRegisterNumbers.push(rawReg)) {
          duplicateRegisterNumbers.push(rawReg);
        }
      } else {
        seenInBatch.add(rawReg.toUpperCase());
      }
    }

    const item: StudentImportRow = {
      registerNumber: rawReg,
      name: rawName,
      isValid: errors.length === 0,
      errors,
    };

    if (item.isValid) {
      validRows.push(item);
    } else {
      invalidRows.push(item);
    }
  }

  return {
    totalRows: rawData.length,
    validRows,
    invalidRows,
    duplicateRegisterNumbers,
  };
}
