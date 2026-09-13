import React, { useState } from "react";
import { useEvent } from "../../hooks/useEvent";
import { useAuth } from "../../hooks/useAuth";
import { createClass, updateClass } from "../../services/classService";
import { type ClassModel, DEPARTMENTS, type Department } from "../../types";
import { Modal } from "../../components/common/Modal";
import { EmptyState } from "../../components/common/EmptyState";
import { Plus, GraduationCap, Edit2 } from "lucide-react";

export const ClassManagement: React.FC = () => {
  const { classes, refreshClasses, loading } = useEvent();
  const { userProfile } = useAuth();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [department, setDepartment] = useState<Department>("CSE");
  const [year, setYear] = useState<number>(3);
  const [section, setSection] = useState<string>("A");
  const [displayName, setDisplayName] = useState<string>("S6 CSE");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit modal
  const [editTarget, setEditTarget] = useState<ClassModel | null>(null);

  const handleDepartmentOrYearChange = (dept: Department, yr: number, sec: string) => {
    setDepartment(dept);
    setYear(yr);
    setSection(sec);
    const sem = yr * 2;
    setDisplayName(`S${sem} ${dept}${sec && sec !== "A" ? `-${sec}` : ""}`);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setFormError("");

    if (!displayName.trim()) {
      setFormError("Class display name is required");
      return;
    }

    setSubmitting(true);
    try {
      await createClass(
        {
          displayName,
          department,
          year,
          section,
        },
        userProfile
      );
      await refreshClasses();
      setCreateModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to create class");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || !userProfile) return;
    setSubmitting(true);
    try {
      await updateClass(
        editTarget.id,
        {
          displayName: editTarget.displayName,
          active: editTarget.active,
        },
        userProfile
      );
      await refreshClasses();
      setEditTarget(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Academic Classes
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage college classes across departments (CSE, CSBS, Cyber, AIDS, Civil, Mech, ECE, SFE, BCA, T1–T6).
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Class</span>
        </button>
      </div>

      {/* Classes Grid */}
      {classes.length === 0 && !loading ? (
        <EmptyState
          icon={GraduationCap}
          title="No Academic Classes"
          description="Add academic classes to start assigning coordinators and importing students."
          actionLabel="Add First Class"
          onAction={() => setCreateModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {classes.map((cls) => (
            <div
              key={cls.id}
              className="glass-panel p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      cls.active
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {cls.active ? "Active" : "Inactive"}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-100 mt-3">{cls.displayName}</h3>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                  <span>Dept: <strong className="text-slate-200">{cls.department}</strong></span>
                  <span>•</span>
                  <span>Year {cls.year}</span>
                  <span>•</span>
                  <span>Sec {cls.section}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-end">
                <button
                  type="button"
                  onClick={() => setEditTarget(cls)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit2 className="w-3 h-3 text-slate-400" />
                  <span>Edit</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Class Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add Academic Class"
        subtitle="Department-wise grouping for batch finance collection"
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-950/60 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
              Department *
            </label>
            <select
              value={department}
              onChange={(e) =>
                handleDepartmentOrYearChange(e.target.value as Department, year, section)
              }
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                Year *
              </label>
              <select
                value={year}
                onChange={(e) =>
                  handleDepartmentOrYearChange(department, Number(e.target.value), section)
                }
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value={1}>1st Year</option>
                <option value={2}>2nd Year</option>
                <option value={3}>3rd Year</option>
                <option value={4}>4th Year</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                Section
              </label>
              <input
                type="text"
                value={section}
                onChange={(e) =>
                  handleDepartmentOrYearChange(department, year, e.target.value.toUpperCase())
                }
                placeholder="A / B / C"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-emerald-500 uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
              Display Name *
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. S6 CSE"
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center gap-2"
            >
              {submitting ? "Adding..." : "Save Class"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      {editTarget && (
        <Modal
          isOpen={!!editTarget}
          onClose={() => setEditTarget(null)}
          title={`Edit ${editTarget.displayName}`}
          maxWidth="md"
        >
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                Display Name
              </label>
              <input
                type="text"
                required
                value={editTarget.displayName}
                onChange={(e) =>
                  setEditTarget({ ...editTarget, displayName: e.target.value })
                }
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-300 pt-2">
              <input
                type="checkbox"
                checked={editTarget.active}
                onChange={(e) =>
                  setEditTarget({ ...editTarget, active: e.target.checked })
                }
                className="rounded bg-slate-900 border-slate-700 text-emerald-500 h-4 w-4"
              />
              <span>Class Active for Collection</span>
            </label>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl"
              >
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
