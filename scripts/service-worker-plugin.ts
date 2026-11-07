// Builds sw.js with a list of this build's files, so each deployment installs itself.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

const hash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 12);
const fileText = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

export function serviceWorkerPlugin(): Plugin {
  return {
    name: 'mockmodeler-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const assets = ['index.html', ...Object.keys(bundle)]
        .filter((name, index, all) => all.indexOf(name) === index)
        .sort();
      const source = fileText('scripts/service-worker-template.js')
        .replace('__ASSETS__', JSON.stringify(assets))
        .replace('__APP_VERSION__', hash(assets.join()));
      // A worker that cannot start fails silently in the page, so catch it here.
      if (/__[A-Z_]+__/.test(source)) throw new Error('sw.js still has a placeholder in it.');
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}
