import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { useEvent } from "../../hooks/useEvent";
import { useAuth } from "../../hooks/useAuth";
import {
  fetchStudentsByClass,
  fetchAllStudents,
  createStudent,
  bulkImportStudents,
} from "../../services/studentService";
import type { StudentModel } from "../../types";
import { Modal } from "../../components/common/Modal";
import { EmptyState } from "../../components/common/EmptyState";
import { validateStudentImportData, type ParseResult } from "../../utils/validators";
import {
  Users,
  Plus,
  FileSpreadsheet,
  Download,
  Upload,
  AlertTriangle,
  Search,
} from "lucide-react";

export const StudentManagement: React.FC = () => {
  const { classes } = useEvent();
  const { userProfile } = useAuth();

  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [students, setStudents] = useState<StudentModel[]>([]);
  const [allStudents, setAllStudents] = useState<StudentModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Single Add modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [registerNumber, setRegisterNumber] = useState("");
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleError, setSingleError] = useState("");

  // Bulk Import modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes]);

  const loadStudents = async () => {
    if (!selectedClassId) return;
    setLoading(true);
    try {
      const [classStudents, all] = await Promise.all([
        fetchStudentsByClass(selectedClassId),
        fetchAllStudents(),
      ]);
      setStudents(classStudents);
      setAllStudents(all);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [selectedClassId]);

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  const handleSingleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !selectedClass) return;
    setSingleError("");

    if (!name.trim() || !registerNumber.trim()) {
      setSingleError("Name and Register Number are required");
      return;
    }

    const exists = allStudents.some(
      (s) => s.registerNumber.toUpperCase() === registerNumber.trim().toUpperCase()
    );
    if (exists) {
      setSingleError(`Register number ${registerNumber} already exists in database.`);
      return;
    }

    setSingleLoading(true);
    try {
      await createStudent(
        {
          name,
          registerNumber,
          classId: selectedClass.id,
          department: String(selectedClass.department),
          year: selectedClass.year,
        },
        userProfile
      );
      await loadStudents();
      setName("");
      setRegisterNumber("");
      setAddModalOpen(false);
    } catch (err: any) {
      setSingleError(err.message || "Failed to add student");
    } finally {
      setSingleLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const wsData = [
      ["Register Number", "Student Name"],
      ["C23CSE01", "Aarav Sharma"],
      ["C23CSE02", "Ananya Menon"],
      ["C23CSE03", "Rahul Varma"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "Student_Import_Template.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setParseResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

        const existingRegs = new Set(allStudents.map((s) => s.registerNumber.toUpperCase()));
        const result = validateStudentImportData(data, existingRegs);
        setParseResult(result);
      } catch (err) {
        console.error("Failed to parse Excel file", err);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    if (!parseResult || !selectedClass || !userProfile) return;
    setImporting(true);

    try {
      await bulkImportStudents(
        parseResult.validRows.map((r) => ({
          name: r.name,
          registerNumber: r.registerNumber,
        })),
        {
          classId: selectedClass.id,
          department: String(selectedClass.department),
          year: selectedClass.year,
        },
        userProfile
      );

      await loadStudents();
      setImportModalOpen(false);
      setImportFile(null);
      setParseResult(null);
    } catch (err) {
      console.error("Import failed:", err);
    } finally {
      setImporting(false);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.registerNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Student Directory
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Maintain permanent college student rosters and import class batches via Excel.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportModalOpen(true)}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Bulk Excel Import</span>
          </button>

          <button
            onClick={() => setAddModalOpen(true)}
            className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Class Selector & Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 glass-panel p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">
            Select Class:
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full sm:w-64 px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.displayName} ({cls.department})
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or reg no..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Student List Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            {selectedClass?.displayName} Students ({filteredStudents.length})
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            Total DB Enrolled: {allStudents.length}
          </span>
        </div>

        {filteredStudents.length === 0 && !loading ? (
          <div className="p-8">
            <EmptyState
              icon={Users}
              title="No Students in this Class"
              description="Import an Excel sheet or manually add students to this class."
              actionLabel="Import Students"
              onAction={() => setImportModalOpen(true)}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Register Number</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Year</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredStudents.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-slate-500 font-mono">{idx + 1}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-200">
                      {s.registerNumber}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-100">{s.name}</td>
                    <td className="py-3 px-4 text-slate-400">{s.department}</td>
                    <td className="py-3 px-4 text-slate-400">Year {s.year}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Single Add Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title={`Add Student to ${selectedClass?.displayName}`}
        maxWidth="md"
      >
        <form onSubmit={handleSingleAdd} className="space-y-4">
          {singleError && (
            <div className="p-3 bg-rose-950/60 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
              {singleError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
              Register Number *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. C23CSE01"
              value={registerNumber}
              onChange={(e) => setRegisterNumber(e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-500 uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
              Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 bg-slate-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={singleLoading}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center gap-2 cursor-pointer"
            >
              {singleLoading ? "Saving..." : "Add Student"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Excel Import Modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => {
          setImportModalOpen(false);
          setImportFile(null);
          setParseResult(null);
        }}
        title={`Bulk Import Students into ${selectedClass?.displayName}`}
        subtitle="Upload standard Excel .xlsx with columns: Register Number | Student Name"
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-xs font-bold text-slate-200">Need the template?</p>
                <p className="text-[11px] text-slate-400">Download formatted Excel import template</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Download Template</span>
            </button>
          </div>

          {/* File Input */}
          <div className="border-2 border-dashed border-slate-700 rounded-2xl p-6 text-center hover:border-emerald-500/50 transition-colors">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
              id="excel-file-upload"
            />
            <label htmlFor="excel-file-upload" className="cursor-pointer space-y-2 block">
              <Upload className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-200">
                {importFile ? importFile.name : "Click or drag .xlsx file to parse"}
              </p>
              <p className="text-[10px] text-slate-500">Supports .xlsx and .xls formats</p>
            </label>
          </div>

          {/* Parse Result Summary & Validation Preview */}
          {parseResult && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <p className="text-[10px] font-semibold text-slate-400">Total Rows</p>
                  <p className="text-lg font-bold text-slate-100">{parseResult.totalRows}</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
                  <p className="text-[10px] font-semibold text-emerald-300">Valid to Import</p>
                  <p className="text-lg font-bold text-emerald-400">{parseResult.validRows.length}</p>
                </div>
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30">
                  <p className="text-[10px] font-semibold text-rose-300">Invalid / Duplicates</p>
                  <p className="text-lg font-bold text-rose-400">{parseResult.invalidRows.length}</p>
                </div>
              </div>

              {parseResult.invalidRows.length > 0 && (
                <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl space-y-1.5">
                  <p className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{parseResult.invalidRows.length} rows contain errors and will be skipped:</span>
                  </p>
                  <div className="max-h-28 overflow-y-auto space-y-1 text-[11px] text-rose-200">
                    {parseResult.invalidRows.slice(0, 5).map((r, i) => (
                      <p key={i}>
                        • {r.registerNumber || "No Reg"} ({r.name || "No Name"}): {r.errors.join(", ")}
                      </p>
                    ))}
                    {parseResult.invalidRows.length > 5 && (
                      <p className="text-slate-400 italic">...and {parseResult.invalidRows.length - 5} more</p>
                    )}
                  </div>
                </div>
              )}

              {/* Preview table */}
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-semibold sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Reg No</th>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {parseResult.validRows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-mono text-slate-200">{r.registerNumber}</td>
                        <td className="py-2 px-3 text-slate-100">{r.name}</td>
                        <td className="py-2 px-3 text-right text-emerald-400 font-semibold">Valid</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setImportModalOpen(false);
                setImportFile(null);
                setParseResult(null);
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-400 bg-slate-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={!parseResult || parseResult.validRows.length === 0 || importing}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {importing ? "Importing..." : `Confirm Import (${parseResult?.validRows.length || 0})`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
