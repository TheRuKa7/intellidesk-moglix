import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'out');
const spaDir = path.join(root, 'spa');

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const file of fs.readdirSync(spaDir)) {
  fs.copyFileSync(path.join(spaDir, file), path.join(outDir, file));
}

fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
console.log('GitHub Pages build written to out/');
