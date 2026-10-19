import React, { useState } from 'react';
import { X, Share2, Copy, Check, ExternalLink, ShieldCheck } from 'lucide-react';
import { ShareLinkItem } from '../types';

interface ShareLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminPin: string;
  projects: string[];
  subProjectsByProject: Record<string, string[]>;
  sheetTabs: string[];
  initialProject?: string;
  onLinkCreated?: (link: ShareLinkItem) => void;
  onRequestPin: () => void;
}

export const ShareLinkModal: React.FC<ShareLinkModalProps> = ({
  isOpen,
  onClose,
  adminPin,
  projects,
  subProjectsByProject,
  sheetTabs,
  initialProject,
  onLinkCreated,
  onRequestPin,
}) => {
  const [selectedProject, setSelectedProject] = useState(
    initialProject && initialProject !== 'ALL' ? initialProject : projects[0] || 'KAFD'
  );
  const [selectedSubProject, setSelectedSubProject] = useState('ALL');
  const [selectedTab, setSelectedTab] = useState('ALL');
  const [clientLabel, setClientLabel] = useState('');
  const [generatedLink, setGeneratedLink] = useState<ShareLinkItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const currentSubProjects = subProjectsByProject[selectedProject] || [];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPin) {
      onRequestPin();
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/share-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': adminPin,
        },
        body: JSON.stringify({
          project_name: selectedProject,
          sub_project_name: selectedSubProject,
          sheet_tab: selectedTab,
          client_label: clientLabel.trim() || `Client Portal - ${selectedProject}`,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setGeneratedLink(data);
        if (onLinkCreated) onLinkCreated(data);
      } else {
        setError(data.error || 'Failed to create share link.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  const fullUrl = generatedLink
    ? `${window.location.origin}/?token=${generatedLink.token}`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base text-slate-900">
              Generate Project Share Link
            </h3>
            <p className="text-xs text-slate-500">
              Create an isolated, token-authenticated portal link locked to a specific project.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}

        {!generatedLink ? (
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Project Name <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedProject}
                onChange={(e) => {
                  setSelectedProject(e.target.value);
                  setSelectedSubProject('ALL');
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sub-Project Scope
                </label>
                <select
                  value={selectedSubProject}
                  onChange={(e) => setSelectedSubProject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
                >
                  <option value="ALL">ALL Sub-Projects (Client can filter)</option>
                  {currentSubProjects.map((sp) => (
                    <option key={sp} value={sp}>
                      {sp}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sheet Tab Lock
                </label>
                <select
                  value={selectedTab}
                  onChange={(e) => setSelectedTab(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
                >
                  <option value="ALL">ALL Tabs</option>
                  {sheetTabs.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Client / Recipient Label (Optional)
              </label>
              <input
                type="text"
                placeholder={`e.g., Executive Portal - ${selectedProject}`}
                value={clientLabel}
                onChange={(e) => setClientLabel(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Strict Security Guarantee</span>
              </div>
              <p>
                When visited via the generated link, only records for{' '}
                <strong>{selectedProject}</strong> and approved visible columns are returned.
                Rows for other projects and internal secrets are completely excluded.
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
                {loading ? 'Generating...' : 'Generate Token Link'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
              <p className="font-semibold text-xs mb-1">Shareable Link Ready!</p>
              <p className="text-[11px] text-emerald-700">
                Locked strictly to <strong>{generatedLink.project_name}</strong>
                {generatedLink.sub_project_name !== 'ALL' && ` (${generatedLink.sub_project_name})`}.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Shareable URL (Token Authenticated)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={fullUrl}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-700 select-all"
                />
                <button
                  onClick={handleCopy}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3">
              <a
                href={fullUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Test Link in New Tab</span>
              </a>
              <button
                onClick={() => setGeneratedLink(null)}
                className="flex-1 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Create Another Link
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
