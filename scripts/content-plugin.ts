// Turns the content folder into JavaScript when the site is built, after checking it. A bad or
// unbalanced question bank stops the build.
//
// Built with a password, the whole bank becomes one encrypted file instead. The page then holds no
// question text at all until someone enters the password. See src/content/lock.ts.
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { deriveKey, encrypt } from '../src/content/crypto.ts';
import { validateContent, type ContentBank } from './lib/validate.ts';

const BANK_ID = 'virtual:question-bank';
const LOCK_ID = 'virtual:content-lock';
const LOCKED_FILE = 'content.bin';
const CONTENT = 'content';
const BANK_PARTS = ['tracks', 'questions', 'scenarios', 'exams', 'notes', 'diagrams'] as const;

async function checkedBank(): Promise<ContentBank> {
  const { errors, bank } = await validateContent(CONTENT);
  if (errors.length > 0) {
    throw new Error(`The question bank has ${errors.length} error(s):\n  ${errors.join('\n  ')}`);
  }
  return bank;
}

function bankModule(bank: ContentBank): string {
  return BANK_PARTS.map((part) => `export const ${part} = ${JSON.stringify(bank[part])};`).join(
    '\n',
  );
}

// A locked build reads the bank that src/content/lock.ts decrypted, so no question is in the code.
function lockedBankModule(): string {
  const lock = JSON.stringify(resolve('src/content/lock.ts').replaceAll('\\', '/'));
  return [
    `import { unlockedBank } from ${lock};`,
    'const bank = unlockedBank();',
    ...BANK_PARTS.map((part) => `export const ${part} = bank.${part};`),
  ].join('\n');
}

// password: lock the built site with this password. Leave it out for an ordinary build.
export function contentPlugin({ password }: { password?: string } = {}): Plugin {
  let key: CryptoKey | undefined;
  return {
    name: 'mockmodeler-content',
    async buildStart() {
      if (password) key = await deriveKey(password);
    },
    resolveId(id) {
      return id === BANK_ID || id === LOCK_ID ? `\0${id}` : null;
    },
    async load(id) {
      if (id === `\0${LOCK_ID}`) {
        const lock = { locked: Boolean(password), file: LOCKED_FILE };
        return `export const contentLock = ${JSON.stringify(lock)};`;
      }
      if (id === `\0${BANK_ID}`) {
        const bank = await checkedBank();
        return password ? lockedBankModule() : bankModule(bank);
      }
      return null;
    },
    async generateBundle() {
      if (!key) return;
      const bank = await checkedBank();
      const source = await encrypt(key, new TextEncoder().encode(JSON.stringify(bank)));
      this.emitFile({ type: 'asset', fileName: LOCKED_FILE, source });
    },
    configureServer(server) {
      const contentDir = resolve(CONTENT);
      server.watcher.add(contentDir);
      server.watcher.on('all', (_event, path) => {
        if (!resolve(path).startsWith(contentDir)) return;
        for (const module of server.moduleGraph.idToModuleMap.values()) {
          if (module.id?.startsWith('\0virtual:')) server.moduleGraph.invalidateModule(module);
        }
        server.ws.send({ type: 'full-reload' });
      });
    },
  };
}
