import React, { useState, useEffect } from "react";
import { useEvent } from "../../hooks/useEvent";
import { useAuth } from "../../hooks/useAuth";
import {
  fetchExpenses,
  createExpense,
  reverseExpense,
  getEventExpenseCategories,
  addCustomExpenseCategory,
  toggleCustomExpenseCategory,
} from "../../services/expenseService";
import type {
  ExpenseCategory,
  ExpenseCategoryConfig,
  ExpenseModel,
} from "../../types";
import { Modal } from "../../components/common/Modal";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { StatusBadge } from "../../components/common/StatusBadge";
import { EmptyState } from "../../components/common/EmptyState";
import { formatINR, formatDateTime } from "../../utils/formatters";
import {
  CreditCard,
  Plus,
  RotateCcw,
  Tags,
  Check,
  X,
} from "lucide-react";

export const ExpensesPage: React.FC = () => {
  const { activeEvent, refreshEvents } = useEvent();
  const { userProfile } = useAuth();

  const [expenses, setExpenses] = useState<ExpenseModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Create Expense Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [item, setItem] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("Decoration");
  const [amount, setAmount] = useState<string>("500");
  const [remarks, setRemarks] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  // Manage Categories Modal
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState("");

  // Reversal Dialog
  const [reverseTarget, setReverseTarget] = useState<ExpenseModel | null>(null);
  const [reverseReason, setReverseReason] = useState("");

  const loadExpenses = async () => {
    if (!activeEvent) return;
    setLoading(true);
    try {
      const list = await fetchExpenses(activeEvent.id);
      setExpenses(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [activeEvent?.id]);

  // Combined event categories
  const configuredCategories = getEventExpenseCategories(activeEvent);
  const activeConfiguredCategories = configuredCategories.filter((c) => c.active);

  // Set default category on open if invalid
  useEffect(() => {
    if (activeConfiguredCategories.length > 0 && !activeConfiguredCategories.some((c) => c.name === category)) {
      setCategory(activeConfiguredCategories[0].name);
    }
  }, [configuredCategories]);

  // Unique categories list for filter bar (includes any historical category present in expenses)
  const historicalCategories = Array.from(new Set(expenses.map((e) => e.category)));
  const filterCategories = Array.from(
    new Set([...configuredCategories.map((c) => c.name), ...historicalCategories])
  );

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent || !userProfile) return;
    setCreateError("");

    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0) {
      setCreateError("Expense amount must be greater than 0");
      return;
    }

    setCreateLoading(true);
    try {
      await createExpense(
        {
          eventId: activeEvent.id,
          category,
          item,
          amount: numAmount,
          remarks,
        },
        userProfile
      );

      await loadExpenses();
      setCreateModalOpen(false);
      setItem("");
      setAmount("500");
      setRemarks("");
    } catch (err: any) {
      setCreateError(err.message || "Failed to add expense");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleAddCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent || !userProfile) return;
    setCatError("");

    if (!newCatName.trim()) {
      setCatError("Please enter a category name");
      return;
    }

    setCatLoading(true);
    try {
      await addCustomExpenseCategory(
        activeEvent.id,
        { name: newCatName, description: newCatDesc },
        userProfile,
        activeEvent.customExpenseCategories || []
      );
      await refreshEvents();
      setNewCatName("");
      setNewCatDesc("");
    } catch (err: any) {
      setCatError(err.message || "Failed to create category");
    } finally {
      setCatLoading(false);
    }
  };

  const handleToggleCategory = async (cat: ExpenseCategoryConfig) => {
    if (!activeEvent || !userProfile) return;
    try {
      await toggleCustomExpenseCategory(
        activeEvent.id,
        cat.id,
        !cat.active,
        userProfile,
        activeEvent.customExpenseCategories || []
      );
      await refreshEvents();
    } catch (err) {
      console.error("Error toggling category:", err);
    }
  };

  const handleReverseSubmit = async () => {
    if (!reverseTarget || !userProfile) return;
    try {
      await reverseExpense(reverseTarget.id, reverseReason, userProfile);
      await loadExpenses();
      setReverseTarget(null);
      setReverseReason("");
    } catch (err) {
      console.error(err);
    }
  };

  const activeExpenses = expenses.filter((e) => e.status === "active");
  const totalActiveSpent = activeExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const filteredExpenses = expenses.filter((e) => {
    if (selectedCategory !== "all" && e.category !== selectedCategory) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Event Expenditures Register
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track categorized expenses with custom event categories, reversal audit support, and budget deduction.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs">
            <span className="text-slate-400">Total Spent: </span>
            <span className="font-mono font-bold text-rose-400">{formatINR(totalActiveSpent)}</span>
          </div>

          <button
            type="button"
            onClick={() => setCategoryModalOpen(true)}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Tags className="w-4 h-4 text-emerald-400" />
            <span>Categories</span>
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expenditure</span>
          </button>
        </div>
      </div>

      {/* Filter by Category */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 glass-panel p-4 rounded-2xl border border-slate-800 no-scrollbar">
        <button
          type="button"
          onClick={() => setSelectedCategory("all")}
          className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            selectedCategory === "all"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
          }`}
        >
          All Categories ({expenses.length})
        </button>
        {filterCategories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedCategory === cat
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Expenses Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Expenditures List ({filteredExpenses.length})
          </h3>
        </div>

        {filteredExpenses.length === 0 && !loading ? (
          <div className="p-8">
            <EmptyState
              icon={CreditCard}
              title="No Expenditures Recorded"
              description="Log event outlays, vendor payments, and operational costs here."
              actionLabel="Add Expenditure"
              onAction={() => setCreateModalOpen(true)}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Item Description</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 font-mono">Amount</th>
                  <th className="py-3 px-4">Logged By</th>
                  <th className="py-3 px-4">Date Logged</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-100 block">{exp.item}</span>
                      {exp.remarks && (
                        <span className="text-[11px] text-slate-400">{exp.remarks}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-extrabold text-sm text-rose-400">
                      {formatINR(exp.amount)}
                    </td>
                    <td className="py-3 px-4 text-slate-300">{exp.addedByName || "Super Admin"}</td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {formatDateTime(exp.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={exp.status} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      {exp.status === "active" && (
                        <button
                          type="button"
                          onClick={() => setReverseTarget(exp)}
                          title="Reverse Expense"
                          className="px-2.5 py-1 bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reverse</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Record New Expenditure"
        maxWidth="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {createError && (
            <div className="p-3 bg-rose-950/60 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
              {createError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
              Item / Purpose *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Stage decoration flowers / DJ sound setup"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase">
                Category *
              </label>
              <button
                type="button"
                onClick={() => {
                  setCreateModalOpen(false);
                  setCategoryModalOpen(true);
                }}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Custom Category</span>
              </button>
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {activeConfiguredCategories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name} {c.isDefault ? "" : "(Custom)"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
              Amount (₹) *
            </label>
            <input
              type="number"
              required
              min="1"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono font-bold text-rose-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
              Remarks / Vendor Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Bill #4298 from City Sounds"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 bg-slate-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLoading}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center gap-2 cursor-pointer"
            >
              {createLoading ? "Saving..." : "Record Expenditure"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Manage Expense Categories Modal */}
      <Modal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title="Manage Expense Categories"
        subtitle={`Configure event-specific categories for "${activeEvent?.name || "Active Event"}"`}
        maxWidth="lg"
      >
        <div className="space-y-6">
          {/* Add New Category Form */}
          <form onSubmit={handleAddCategorySubmit} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Create New Category</span>
            </h4>

            {catError && (
              <div className="p-2.5 bg-rose-950/60 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
                {catError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Flowers / Rope / Stage Props"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ceremony fresh flower arrangements"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={catLoading}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{catLoading ? "Adding..." : "Add Category"}</span>
              </button>
            </div>
          </form>

          {/* Existing Categories List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Configured Categories ({configuredCategories.length})
            </h4>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900/60">
              {configuredCategories.map((c) => (
                <div
                  key={c.id}
                  className="p-3 flex items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-100">{c.name}</span>
                      {c.isDefault ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                          Default
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                          Custom
                        </span>
                      )}
                      {!c.active && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300">
                          Disabled
                        </span>
                      )}
                    </div>
                    {c.description && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{c.description}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleCategory(c)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      c.active
                        ? "bg-rose-950/60 text-rose-300 border border-rose-800/60 hover:bg-rose-900"
                        : "bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900"
                    }`}
                  >
                    {c.active ? (
                      <>
                        <X className="w-3 h-3" />
                        <span>Disable</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Enable</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCategoryModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Reverse Confirm Dialog */}
      {reverseTarget && (
        <ConfirmDialog
          isOpen={!!reverseTarget}
          onClose={() => setReverseTarget(null)}
          onConfirm={handleReverseSubmit}
          title="Reverse Expenditure Record"
          message={`Are you sure you want to reverse the expense "${reverseTarget.item}" (${formatINR(
            reverseTarget.amount
          )})? This will restore the budget balance and create an immutable audit record.`}
          confirmLabel="Reverse Expense"
          variant="warning"
        />
      )}
    </div>
  );
};
