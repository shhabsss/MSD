import { Download, Smartphone, X } from 'lucide-react';
import React, { useState } from 'react';
import { usePWAInstall } from './usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed standalone PWA, hide button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-sm transition-colors cursor-pointer shrink-0"
        title="Install MSD App on your Device"
        id="btn-install-pwa-app"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs transition-colors cursor-pointer shrink-0"
          id="btn-install-ios-app"
        >
          <Smartphone className="w-3.5 h-3.5 text-blue-400" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl text-slate-900 border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-blue-600" />
                  Install MSD App on iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 text-xs text-slate-600 space-y-2 leading-relaxed">
                <p>
                  1. Tap the <strong>Share</strong> button (box with an arrow pointing up) at the bottom of Safari.
                </p>
                <p>
                  2. Scroll down and tap <strong>&ldquo;Add to Home Screen&rdquo;</strong> (होम स्क्रीन पर जोड़ें).
                </p>
                <p>
                  3. Tap <strong>Add</strong> in the top right corner.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-lg bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-500 transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
