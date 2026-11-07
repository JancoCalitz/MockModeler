import { useState, type ChangeEvent } from 'react';
import { exportProgress, importProgress } from '../attempt/backup.ts';
import { contentLocked, forgetDevice } from '../content/lock.ts';

function download(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function DataScreen() {
  const [progressMessage, setProgressMessage] = useState('');

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clearing this lets the same file be chosen again, such as after fixing a mistake in it.
    event.target.value = '';
    if (!file) return;
    const result = importProgress(await file.text());
    setProgressMessage(result.ok ? `Restored ${result.imported} attempts.` : result.error);
  };

  const buttonClass = 'ui-btn rounded border border-slate-300 px-3 py-1.5 text-sm font-medium';

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 font-sans text-slate-900 sm:px-8">
      <h1 className="text-3xl font-bold">Backups</h1>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Your progress</h2>
        <p className="mt-1 text-sm text-slate-700">
          Your attempts on both certifications are only stored in this browser, and clearing its
          data deletes them. A backup file keeps them safe, or moves them to another browser.
        </p>
        <button
          type="button"
          className={`${buttonClass} mt-3`}
          onClick={() => download('mockmodeler-progress.json', exportProgress())}
        >
          Back up my progress
        </button>
        <label className="mt-3 block text-sm font-medium">
          Restore from a backup
          <input
            type="file"
            accept=".json"
            className="mt-1 block text-sm"
            onChange={(event) => void importBackup(event)}
          />
        </label>
        {progressMessage && (
          <p role="status" className="mt-2 text-sm">
            {progressMessage}
          </p>
        )}
      </section>

      {contentLocked && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">This device</h2>
          <p className="mt-1 text-sm text-slate-700">
            This site is locked with a password. Locking this device means the password is needed
            again here. Your progress stays.
          </p>
          <button
            type="button"
            className={`${buttonClass} mt-3`}
            onClick={() => {
              forgetDevice();
              location.reload();
            }}
          >
            Lock this device
          </button>
        </section>
      )}
    </main>
  );
}
