import React from 'react';
import {
  Download,
  Sparkles,
  CheckCircle2,
  X,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { UpdateInfo, UpdateProgress, isAndroidNative } from '../../services/updateService';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: UpdateInfo | null;
  currentVersion: string;
  isUpdating: boolean;
  progress: UpdateProgress;
  onStartUpdate: () => void;
  error?: string | null;
  statusMessage?: string | null;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} Mo`;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  updateInfo,
  currentVersion,
  isUpdating,
  progress,
  onStartUpdate,
  error,
  statusMessage,
}) => {
  if (!isOpen || !updateInfo) return null;

  const isAndroid = isAndroidNative();
  const platformSize =
    isAndroid
      ? updateInfo.platforms?.android?.size || updateInfo.platforms?.android_tv?.size
      : updateInfo.platforms?.windows?.size || '85 Mo';

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div
        className="relative w-full max-w-lg bg-[#0d091a] border border-emerald-500/30 rounded-2xl p-6 sm:p-8 shadow-[0_0_50px_rgba(0,255,135,0.15)] text-white overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Glow ambient background */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close button */}
        {!isUpdating && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header with Version Badges */}
        <div className="flex items-start gap-4 mb-5">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-black shadow-lg shadow-emerald-500/20 flex-shrink-0">
            <Sparkles className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Mise à jour disponible
              </span>
              {platformSize && (
                <span className="text-xs text-zinc-400 font-mono">
                  Taille : {platformSize}
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mt-1 tracking-tight text-white">
              {updateInfo.title || `Dawger v${updateInfo.version}`}
            </h2>
            <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
              <span>Actuelle : v{currentVersion}</span>
              <ArrowRight className="w-3 h-3 text-zinc-500" />
              <span className="text-emerald-400 font-semibold">Nouvelle : v{updateInfo.version}</span>
            </div>
          </div>
        </div>

        {/* Changelog Section */}
        {updateInfo.changelog && updateInfo.changelog.length > 0 && (
          <div className="my-5 p-4 rounded-xl bg-black/40 border border-white/10">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-400 mb-2.5">
              Nouveautés & Correctifs :
            </p>
            <ul className="space-y-2 text-sm text-zinc-300">
              {updateInfo.changelog.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Status & Error Messages */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {statusMessage && !error && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Download Progress Bar */}
        {isUpdating && (
          <div className="my-5 p-4 rounded-xl bg-black/50 border border-emerald-500/30 shadow-[0_0_20px_rgba(0,255,135,0.1)]">
            <div className="flex justify-between items-center text-xs text-zinc-300 mb-2">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                <span className="font-medium">Téléchargement de la mise à jour...</span>
              </span>
              <div className="flex items-center gap-2 font-mono">
                {progress.bytesDownloaded && progress.totalBytes ? (
                  <span className="text-[11px] text-zinc-400">
                    {formatBytes(progress.bytesDownloaded)} / {formatBytes(progress.totalBytes)}
                  </span>
                ) : null}
                <span className="font-bold text-emerald-400 text-sm">
                  {progress.percent >= 0 ? `${progress.percent}%` : '0%'}
                </span>
              </div>
            </div>

            {/* Glowing Liquid Progress Bar */}
            <div className="w-full h-3 bg-zinc-800/90 rounded-full overflow-hidden p-0.5 border border-white/10 relative">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 via-teal-300 to-purple-500 transition-all duration-300 ease-out rounded-full shadow-[0_0_12px_rgba(0,255,135,0.6)]"
                style={{ width: `${Math.max(4, Math.min(100, progress.percent))}%` }}
              />
            </div>

            <div className="flex justify-between items-center mt-2 text-[11px] text-zinc-400">
              <span>{isAndroid ? 'Ouverture de l\'installateur à 100%' : 'Téléchargement direct du paquet'}</span>
              <span className="text-emerald-400 font-mono">{progress.percent === 100 ? 'Finalisation...' : 'En cours'}</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-zinc-800/80">
          {!isUpdating && (
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Plus tard
            </button>
          )}

          <button
            onClick={onStartUpdate}
            disabled={isUpdating}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-black bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25 transition-all transform active:scale-95"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Téléchargement ({progress.percent >= 0 ? `${progress.percent}%` : '...'})</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Mettre à jour maintenant</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
