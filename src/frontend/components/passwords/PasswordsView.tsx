import { useState, useEffect, useRef } from 'react';
import { useDialogStore } from '../../stores/dialog.store';
import {
  usePasswordStatus,
  usePasswords,
  usePasswordById,
  useSetupMaster,
  useUnlockVault,
  useLockVault,
  useCreatePassword,
  useUpdatePassword,
  useDeletePassword,
  useBulkDeletePasswords,
  useToggleFavorite,
  useParseImport,
  useConfirmImport,
  ParseResult,
} from '../../hooks/usePasswords';
import { apiFetch } from '../../lib/api';
import { t } from '../../lib/i18n';
import { Dropdown } from '../ui/Dropdown';
import { Modal } from '../ui/Modal';
import { ResizableTextarea } from '../ui/ResizableTextarea';

const CATEGORY_LABELS: Record<string, { en: string; es: string }> = {
  email: { en: 'Email', es: 'Email' },
  social: { en: 'Social', es: 'Social' },
  dev: { en: 'Dev', es: 'Dev' },
  finance: { en: 'Finance', es: 'Finanzas' },
  gaming: { en: 'Gaming', es: 'Gaming' },
  work: { en: 'Work', es: 'Trabajo' },
  other: { en: 'Other', es: 'Otros' },
};

const CATEGORIES = ['email', 'social', 'dev', 'finance', 'gaming', 'work', 'other'];

// Consistent button styles matching the rest of the app
const BTN_PRIMARY =
  'px-3 py-1 text-sm bg-matrix-accent/10 text-matrix-accent border border-matrix-accent/30 rounded hover:bg-matrix-accent/20 transition-colors disabled:opacity-40';
const BTN_SECONDARY =
  'px-3 py-1 text-sm text-gray-400 border border-matrix-border rounded hover:bg-matrix-border/50 transition-colors';
const BTN_PRIMARY_WIDE =
  'w-full py-2 text-sm bg-matrix-accent/10 text-matrix-accent border border-matrix-accent/30 rounded hover:bg-matrix-accent/20 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed';

function getCategoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat]?.en || cat;
}

function SetupScreen({ onComplete }: { onComplete: () => void }) {
  const setup = useSetupMaster();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const strength = password.length < 8 ? 'red' : password.length < 12 ? 'yellow' : 'green';
  const canSubmit = password.length >= 8 && password === confirm && !setup.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError(t('passwordsDontMatch'));
      return;
    }
    setError('');
    await setup.mutateAsync(password);
    onComplete();
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-matrix-bg border border-matrix-border rounded-lg p-8 w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-200 mb-6">{t('setupVault')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('masterPassword')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-matrix-bg border border-matrix-border rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-matrix-accent/50"
              placeholder="••••••••"
            />
            {password && (
              <div className="mt-2 h-1 rounded bg-matrix-border overflow-hidden">
                <div
                  className={`h-full transition-all ${strength === 'red' ? 'bg-red-500' : strength === 'yellow' ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: password.length < 8 ? '25%' : password.length < 12 ? '60%' : '100%' }}
                />
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('confirmPassword')}</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full bg-matrix-bg border border-matrix-border rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-matrix-accent/50"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <p className="text-xs text-matrix-muted">{t('vaultWarning')}</p>
          <button type="submit" disabled={!canSubmit} className={BTN_PRIMARY_WIDE}>
            {t('setupVault')}
          </button>
        </form>
      </div>
    </div>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const unlock = useUnlockVault();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await unlock.mutateAsync(password);
      onUnlock();
    } catch {
      setError(t('incorrectPassword'));
      setTimeout(() => setError(''), 3000);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-matrix-bg border border-matrix-border rounded-lg p-8 w-full max-w-md text-center">
        <div className="text-5xl mb-6 opacity-60">🔒</div>
        <h2 className="text-lg font-semibold text-gray-200 mb-6">{t('unlockVault')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-matrix-bg border border-matrix-border rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-matrix-accent/50"
            placeholder={t('masterPassword')}
            autoFocus
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button type="submit" disabled={!password || unlock.isPending} className={BTN_PRIMARY_WIDE}>
            {t('unlock')}
          </button>
        </form>
      </div>
    </div>
  );
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const parseImport = useParseImport();
  const confirmImport = useConfirmImport();
  const [step, setStep] = useState<'select' | 'parsing' | 'preview' | 'confirm'>('select');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [imported, setImported] = useState<{ inserted: number; skippedDuplicates: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    if (!content) return;
    setStep('parsing');
    const res = (await parseImport.mutateAsync(content)) as ParseResult;
    setResult(res);
    setSelected(new Set(res.parsed.map((_, i) => i)));
    setStep('preview');
    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirm = async () => {
    if (!result) return;
    const entries = result.parsed.filter((_, i) => selected.has(i));
    const res = (await confirmImport.mutateAsync(
      entries.map((e) => ({
        label: e.label,
        domain: e.domain,
        username: e.username,
        password: e.password,
      })),
    )) as { inserted: number; skippedDuplicates: number };
    setImported(res);
    setStep('confirm');
  };

  const toggleAll = (select: boolean) => {
    if (!result) return;
    if (select) {
      setSelected(new Set(result.parsed.map((_, i) => i)));
    } else {
      setSelected(new Set());
    }
  };

  return (
    <Modal title={t('importPasswords')} onClose={onClose} maxWidth="max-w-2xl">
      <div className="max-h-[70vh] overflow-auto">
        {step === 'select' && (
          <>
            <p className="text-xs text-matrix-muted mb-4">{t('importNote')}</p>
            <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileChange} className="hidden" />
            <div className="flex gap-2">
              <button onClick={handleSelect} className={BTN_PRIMARY}>
                📁 {t('selectFile')}
              </button>
              <button onClick={onClose} className={BTN_SECONDARY}>
                {t('cancel')}
              </button>
            </div>
          </>
        )}
        {step === 'parsing' && (
          <div className="text-center py-8">
            <div className="animate-spin text-3xl mb-4">⏳</div>
            <p className="text-xs text-gray-400">{t('parsing')}</p>
          </div>
        )}
        {step === 'preview' && result && (
          <>
            <h3 className="text-sm font-semibold text-gray-200 mb-2">{t('importPreview')}</h3>
            <p className="text-xs text-matrix-muted mb-4">
              {result.parsed.length} {t('linesMatched')} · {result.unmatched.length} {t('linesUnmatched')}
            </p>
            <div className="flex gap-2 mb-4">
              <button onClick={() => toggleAll(true)} className="text-xs text-matrix-accent hover:underline">
                {t('selectAll')}
              </button>
              <button onClick={() => toggleAll(false)} className="text-xs text-matrix-muted hover:underline">
                {t('selectNone')}
              </button>
            </div>
            <div className="max-h-64 overflow-auto border border-matrix-border rounded">
              <table className="w-full text-xs">
                <thead className="bg-matrix-border/30 sticky top-0">
                  <tr>
                    <th className="p-2 text-left text-gray-400"></th>
                    <th className="p-2 text-left text-gray-400">{t('label')}</th>
                    <th className="p-2 text-left text-gray-400">{t('domain')}</th>
                    <th className="p-2 text-left text-gray-400">{t('username')}</th>
                    <th className="p-2 text-left text-gray-400">{t('confidence')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.parsed.map((entry, i) => (
                    <tr key={i} className="border-t border-matrix-border">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selected.has(i)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            e.target.checked ? next.add(i) : next.delete(i);
                            setSelected(next);
                          }}
                          className="matrix-checkbox"
                        />
                      </td>
                      <td className="p-2 text-gray-200">{entry.label}</td>
                      <td className="p-2 text-gray-400">{entry.domain || '-'}</td>
                      <td className="p-2 text-gray-400">{entry.username || '-'}</td>
                      <td className="p-2">
                        <span
                          className={`text-xs ${entry.confidence === 'high' ? 'text-green-400' : entry.confidence === 'medium' ? 'text-yellow-400' : 'text-red-400'}`}
                        >
                          {entry.confidence === 'high'
                            ? t('confidenceHigh')
                            : entry.confidence === 'medium'
                              ? t('confidenceMedium')
                              : t('confidenceLow')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleConfirm}
                disabled={selected.size === 0 || confirmImport.isPending}
                className={BTN_PRIMARY}
              >
                {t('confirmImport')} ({selected.size})
              </button>
              <button onClick={onClose} className={BTN_SECONDARY}>
                {t('cancel')}
              </button>
            </div>
          </>
        )}
        {step === 'confirm' && imported && (
          <>
            <h3 className="text-sm font-semibold text-gray-200 mb-4">{t('importComplete')}</h3>
            <p className="text-xs text-gray-300">
              ✓ {imported.inserted} {t('imported')} · {imported.skippedDuplicates} {t('duplicatesSkipped')}
            </p>
            <button onClick={onClose} className={`mt-4 ${BTN_PRIMARY}`}>
              {t('done')}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

function EditModal({ entryId, onClose }: { entryId: number | null; onClose: () => void }) {
  const isEditing = entryId !== null;
  const { data: entry, isLoading, isError } = usePasswordById(entryId);
  const create = useCreatePassword();
  const update = useUpdatePassword();
  const [label, setLabel] = useState('');
  const [domain, setDomain] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [category, setCategory] = useState<string>('other');
  const [notes, setNotes] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (entry) {
      setLabel(entry.label);
      setDomain(entry.domain || '');
      setUsername(entry.username || '');
      setPassword(entry.password || '');
      setCategory(entry.category);
      setNotes(entry.notes || '');
    }
  }, [entry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isEditing && entryId) {
        await update.mutateAsync({ id: entryId, label, domain, username, password, category, notes });
      } else {
        await create.mutateAsync({ label, domain, username, password, category, notes });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const inputClass =
    'w-full bg-matrix-bg border border-matrix-border rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-matrix-accent/50';

  if (isEditing && isLoading) {
    return (
      <Modal title="Loading..." onClose={onClose}>
        <p className="text-sm text-gray-400">Loading...</p>
      </Modal>
    );
  }

  if (isEditing && isError) {
    return (
      <Modal title="Failed to decrypt entry" onClose={onClose}>
        <p className="text-xs text-gray-400 mb-4">
          This entry may have been encrypted with a different master password or the data is corrupted.
        </p>
        <button onClick={onClose} className={BTN_SECONDARY}>
          {t('cancel')}
        </button>
      </Modal>
    );
  }

  return (
    <Modal title={isEditing ? t('editPassword') : t('newPassword')} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t('label')}
          className={inputClass}
          required
        />
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder={t('domain')}
          className={inputClass}
        />
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t('username')}
          className={inputClass}
        />
        <div className="flex gap-2">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={showPassword ? 'text' : 'password'}
            placeholder={t('password')}
            className={`flex-1 ${inputClass}`}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-xs text-gray-400 hover:text-gray-200 px-2"
          >
            {showPassword ? t('hidePassword') : t('showPassword')}
          </button>
        </div>
        <Dropdown
          value={category}
          onChange={setCategory}
          options={CATEGORIES.map((c) => ({ value: c, label: getCategoryLabel(c) }))}
        />
        <ResizableTextarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('notes')} rows={3} />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={create.isPending || update.isPending}
            className={`flex-1 ${BTN_PRIMARY_WIDE}`}
          >
            {t('save')}
          </button>
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>
            {t('cancel')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function PasswordsView() {
  const { data: status, refetch } = usePasswordStatus();
  const isUnlocked = status?.isUnlocked ?? false;
  const { data: passwords, refetch: refetchList } = usePasswords(undefined, undefined, isUnlocked);
  const lock = useLockVault();
  const toggleFav = useToggleFavorite();
  const deletePwd = useDeletePassword();
  const bulkDelete = useBulkDeletePasswords();
  const { confirm } = useDialogStore();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [showImport, setShowImport] = useState(false);
  const [editTarget, setEditTarget] = useState<number | 'new' | false>(false);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<string>('');
  const [copied, setCopied] = useState<number | null>(null);
  const [revealError, setRevealError] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const clipboardTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // Clean up revealed password and clipboard timers on unmount
  useEffect(() => {
    return () => {
      setRevealedPassword('');
      Object.values(clipboardTimers.current).forEach(clearTimeout);
    };
  }, []);

  const isSetup = status?.isSetup ?? false;

  const filtered = passwords?.filter((p) => {
    if (category !== 'all' && p.category !== category) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        p.label.toLowerCase().includes(s) ||
        p.domain?.toLowerCase().includes(s) ||
        p.username?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const allFilteredIds = filtered?.map((p) => p.id) ?? [];
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allFilteredIds));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const ok = await confirm({
      title: `Delete ${count} password${count > 1 ? 's' : ''}?`,
      danger: true,
    });
    if (!ok) return;
    await bulkDelete.mutateAsync([...selectedIds]);
    setSelectedIds(new Set());
  };

  const handleReveal = async (id: number) => {
    if (revealed === id) {
      setRevealed(null);
      setRevealedPassword('');
      return;
    }
    setRevealError(null);
    try {
      const entry = await apiFetch<{ password: string }>(`/passwords/${id}`);
      setRevealed(id);
      setRevealedPassword(entry.password);
      setTimeout(() => {
        setRevealed(null);
        setRevealedPassword('');
      }, 5000);
    } catch {
      setRevealError(id);
      setTimeout(() => setRevealError(null), 3000);
    }
  };

  const handleCopy = async (id: number) => {
    try {
      const entry = await apiFetch<{ password: string }>(`/passwords/${id}`);
      await navigator.clipboard.writeText(entry.password);
      setCopied(id);
      if (clipboardTimers.current[id]) clearTimeout(clipboardTimers.current[id]);
      clipboardTimers.current[id] = setTimeout(() => {
        navigator.clipboard.writeText('').catch(() => {});
        setCopied(null);
      }, 30000);
    } catch {
      setRevealError(id);
      setTimeout(() => setRevealError(null), 3000);
    }
  };

  const handleLock = async () => {
    await lock.mutateAsync();
    refetch();
  };

  if (!isSetup) {
    return <SetupScreen onComplete={() => refetch()} />;
  }

  if (!isUnlocked) {
    return <LockScreen onUnlock={() => refetch()} />;
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h1 className="text-lg font-semibold text-gray-200 shrink-0">{t('vault')}</h1>
        <div className="flex gap-2">
          <button onClick={handleLock} className={BTN_SECONDARY}>
            🔒 <span className="hidden sm:inline">{t('lock')}</span>
          </button>
          <button onClick={() => setEditTarget('new')} className={BTN_PRIMARY}>
            + <span className="hidden sm:inline">{t('newPassword')}</span>
          </button>
          <button onClick={() => setShowImport(true)} className={BTN_SECONDARY}>
            ↑ <span className="hidden sm:inline">{t('import')}</span>
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`🔍 ${t('search')}...`}
          className="flex-1 min-w-0 bg-matrix-bg border border-matrix-border rounded px-3 py-1.5 text-sm text-gray-200 placeholder-matrix-muted focus:outline-none focus:border-matrix-accent/50"
        />
        <Dropdown
          value={category}
          onChange={setCategory}
          options={[
            { value: 'all', label: t('allCategories') },
            ...CATEGORIES.map((c) => ({ value: c, label: getCategoryLabel(c) })),
          ]}
        />
      </div>

      {someSelected && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-matrix-border/30 border border-matrix-border rounded text-xs">
          <span className="text-gray-300">{selectedIds.size} selected</span>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDelete.isPending}
            className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
          >
            🗑 Delete selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      <div className="bg-matrix-bg border border-matrix-border rounded overflow-hidden">
        <table className="w-full table-fixed">
          <thead className="bg-matrix-border/30">
            <tr>
              <th className="p-2.5 w-8">
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="matrix-checkbox" />
              </th>
              <th className="p-2.5 w-8 hidden md:table-cell text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                ★
              </th>
              <th className="p-2.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                {t('label')}
              </th>
              <th className="p-2.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                {t('domain')}
              </th>
              <th className="p-2.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                {t('username')}
              </th>
              <th className="p-2.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell w-24">
                {t('password')}
              </th>
              <th className="p-2.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell w-20">
                {t('category')}
              </th>
              <th className="p-2.5 w-28 sm:w-36"></th>
            </tr>
          </thead>
          <tbody>
            {filtered?.map((p) => (
              <tr
                key={p.id}
                className={`border-t border-matrix-border hover:bg-matrix-border/20 ${selectedIds.has(p.id) ? 'bg-matrix-accent/5' : ''}`}
              >
                <td className="p-2.5">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleSelect(p.id)}
                    className="matrix-checkbox"
                  />
                </td>
                <td className="p-2.5 hidden md:table-cell">
                  <button
                    onClick={() => toggleFav.mutate(p.id)}
                    className={`text-sm ${p.favorite ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-400'}`}
                  >
                    ★
                  </button>
                </td>
                <td className="p-2.5 text-sm text-gray-200 truncate max-w-0">
                  <span className="truncate block">{p.label}</span>
                  <span className="text-[10px] text-gray-500 truncate block lg:hidden">
                    {p.domain || ''}
                    {p.domain && p.username ? ' · ' : ''}
                    {p.username || ''}
                  </span>
                </td>
                <td className="p-2.5 text-xs text-gray-400 truncate max-w-0 hidden lg:table-cell">{p.domain || '-'}</td>
                <td className="p-2.5 text-xs text-gray-400 truncate max-w-0 hidden xl:table-cell">
                  {p.username || '-'}
                </td>
                <td className="p-2.5 hidden sm:table-cell">
                  {revealError === p.id ? (
                    <span className="text-xs text-red-400">error</span>
                  ) : revealed === p.id ? (
                    <span className="font-mono text-xs text-gray-200 truncate block">{revealedPassword}</span>
                  ) : (
                    <span className="text-xs text-gray-500">••••••••</span>
                  )}
                </td>
                <td className="p-2.5 text-xs text-gray-500 hidden lg:table-cell">{getCategoryLabel(p.category)}</td>
                <td className="p-2.5">
                  <div className="flex gap-0.5 justify-end">
                    <button
                      onClick={() => handleReveal(p.id)}
                      className="p-1 text-gray-500 hover:text-gray-200 text-sm"
                      title={t('showPassword')}
                    >
                      👁
                    </button>
                    <button
                      onClick={() => handleCopy(p.id)}
                      className="p-1 text-gray-500 hover:text-gray-200 text-sm"
                      title={t('copyPassword')}
                    >
                      {copied === p.id ? <span className="text-green-400 text-xs">✓</span> : '📋'}
                    </button>
                    <button
                      onClick={() => setEditTarget(p.id)}
                      className="p-1 text-gray-500 hover:text-gray-200 text-sm"
                      title={t('edit')}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={async () => {
                        const ok = await confirm({ title: t('confirmDelete'), danger: true });
                        if (ok) deletePwd.mutate(p.id);
                      }}
                      className="p-1 text-gray-500 hover:text-red-400 text-sm"
                      title={t('delete')}
                    >
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(!filtered || filtered.length === 0) && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-xs text-gray-500">
                  {t('noPasswords')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[10px] text-matrix-muted">
        {passwords?.length || 0} {t('passwordsCount')}
      </p>

      {showImport && (
        <ImportModal
          onClose={() => {
            setShowImport(false);
            refetchList();
          }}
        />
      )}
      {editTarget !== false && (
        <EditModal
          entryId={editTarget === 'new' ? null : editTarget}
          onClose={() => {
            setEditTarget(false);
            refetchList();
          }}
        />
      )}
    </div>
  );
}
