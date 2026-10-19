import React, { useState } from 'react';
import { Lock, X, KeyRound, AlertCircle } from 'lucide-react';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (pin: string) => void;
  title?: string;
  description?: string;
}

export const PinModal: React.FC<PinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = 'Admin Authorization Required',
  description = 'Enter your 6-digit Admin PIN to access configuration and management features.',
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Please enter your Admin PIN.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess(pin.trim());
        setPin('');
        onClose();
      } else {
        setError(data.error || 'Invalid Admin PIN.');
      }
    } catch (err: any) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-4">
          <KeyRound className="w-6 h-6" />
        </div>

        <h3 className="font-display font-bold text-lg text-slate-900 mb-1">{title}</h3>
        <p className="text-xs text-slate-500 mb-5 leading-relaxed">{description}</p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Admin PIN
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                maxLength={12}
                autoFocus
                placeholder="Enter PIN (Default: 123456)"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-center font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 text-center">
              Default system PIN: <span className="font-mono font-semibold text-slate-600">123456</span>
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              {loading ? 'Verifying...' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
