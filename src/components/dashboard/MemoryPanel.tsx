import React, { useState, useEffect } from 'react';
import {
  Brain,
  Plus,
  Trash2,
  CheckCircle,
  Download,
  Filter,
  Tag,
  AlertCircle,
} from 'lucide-react';
import { useMemoryStore } from '../../store/memoryStore.ts';
import { MemoryEntry } from '../../types/zara.types.ts';

export const MemoryPanel: React.FC = () => {
  const { memories, filterCategory, setFilterCategory, fetchMemories, addMemory, deleteMemory, approveMemory } =
    useMemoryStore();

  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryEntry['category']>('preference');
  const [newImportance, setNewImportance] = useState<MemoryEntry['importance']>('medium');
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    fetchMemories();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;

    await addMemory({
      key: newKey.trim(),
      value: newValue.trim(),
      category: newCategory,
      importance: newImportance,
      userApproved: true,
      isActive: true,
    });

    setNewKey('');
    setNewValue('');
    setShowAddForm(false);
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(memories, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `zara-memory-export-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filtered =
    filterCategory === 'all'
      ? memories
      : memories.filter((m) => m.category === filterCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-brand font-bold text-white tracking-wide">
              Memory Center
            </h2>
            <span className="text-sm font-urdu text-amber-400">(یادداشت کا مرکز)</span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            User-approved preferences, personal facts, and instructions that ZARA remembers across sessions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJson}
            className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 text-xs font-mono flex items-center gap-2 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Add Memory</span>
          </button>
        </div>
      </div>

      {/* Add Memory Modal/Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreate}
          className="p-5 rounded-2xl bg-[#151520] border border-amber-500/40 space-y-4 animate-in fade-in"
        >
          <h3 className="text-sm font-semibold text-white">Create New Long-Term Memory</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-1">KEY / TITLE</label>
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="e.g. Favorite Coffee"
                className="w-full bg-[#0A0A0F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-1">CATEGORY</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="w-full bg-[#0A0A0F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
              >
                <option value="preference">Preference</option>
                <option value="fact">Fact</option>
                <option value="instruction">Instruction</option>
                <option value="contact">Contact</option>
                <option value="task">Task</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1">DETAIL / VALUE</label>
            <textarea
              rows={2}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="e.g. Dark roast with no sugar"
              className="w-full bg-[#0A0A0F] border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-500 text-black font-semibold text-xs"
            >
              Save Memory
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 text-xs">
        {['all', 'preference', 'fact', 'instruction', 'contact', 'task'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1.5 rounded-lg font-mono uppercase transition-all ${
              filterCategory === cat
                ? 'bg-amber-500 text-black font-bold'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-white/5'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Memory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-xs text-zinc-500">
            Abhi tak kuch yaad nahi kiya. Jo important ho, woh save karein.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-2xl bg-[#111118] border border-white/10 hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase">
                    {item.category}
                  </span>

                  <span
                    className={`text-[10px] font-mono uppercase ${
                      item.importance === 'high'
                        ? 'text-rose-400'
                        : item.importance === 'medium'
                        ? 'text-amber-400'
                        : 'text-zinc-500'
                    }`}
                  >
                    {item.importance} priority
                  </span>
                </div>

                <h4 className="font-semibold text-sm text-white mb-1">{item.key}</h4>
                <p className="text-xs text-zinc-300 leading-relaxed">{item.value}</p>
              </div>

              <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500">
                <span className="font-mono">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>

                <div className="flex items-center gap-2">
                  {!item.userApproved && (
                    <button
                      onClick={() => approveMemory(item.id)}
                      className="text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                  )}
                  <button
                    onClick={() => deleteMemory(item.id)}
                    className="text-zinc-500 hover:text-rose-400 p-1"
                    title="Delete Memory"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
