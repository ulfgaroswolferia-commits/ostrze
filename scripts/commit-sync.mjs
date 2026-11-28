import { execFileSync, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const rootDir = process.cwd();
const engineDir = path.join(rootDir, 'engine');

function runGit(args, cwd = rootDir) {
  return execFileSync('git', args, { cwd, stdio: 'inherit' });
}

function getGitOutput(args, cwd = rootDir) {
  return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'inherit'] }).trim();
}

const rawArgs = process.argv.slice(2);
const skipVerify = rawArgs.includes('--no-verify');
const msgParts = rawArgs.filter((a) => a !== '--no-verify');
const commitMsg =
  msgParts.join(' ').trim() ||
  `chore: synchronized updates (game + engine ${new Date().toISOString().slice(0, 10)})`;

console.log(`\n=== Synchronizacja i commit (Gra + Silnik) ===`);
console.log(`Komunikat commitu: "${commitMsg}"\n`);

if (!skipVerify) {
  console.log('[0/2] Walidacja przed commitem (npm run build && npm test)...');
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });
  execSync('npm test', { cwd: rootDir, stdio: 'inherit' });
  console.log('✓ Build i testy jednostkowe przeszły pomyślnie.\n');
}

let engineUpdated = false;

// 1. Sprawdź i zacommituj silnik (submodule engine/)
if (fs.existsSync(engineDir)) {
  const engineStatus = getGitOutput(['status', '--porcelain'], engineDir);
  if (engineStatus) {
    console.log('-> Wykryto zmiany w submodule silnika (engine/):');
    console.log(engineStatus);
    console.log('\n[1/2] Commitowanie i pushowanie silnika (engine/)...');
    runGit(['add', '-A'], engineDir);
    runGit(['commit', '-m', commitMsg], engineDir);
    runGit(['push', 'origin', 'main'], engineDir);
    engineUpdated = true;
    console.log('✓ Silnik został zaktualizowany i wypchnięty na origin/main.\n');
  } else {
    console.log('✓ Submodule silnika (engine/) nie posiada lokalnych zmian roboczych.');
  }
} else {
  console.log('! Katalog engine/ nie istnieje. Pomijanie commitu w submodule.');
}

// 2. Sprawdź i zacommituj grę (ostrze)
const gameStatus = getGitOutput(['status', '--porcelain'], rootDir);
if (gameStatus || engineUpdated) {
  console.log('\n[2/2] Commitowanie i pushowanie gry (ostrze)...');
  runGit(['add', '-A'], rootDir);
  runGit(['commit', '-m', commitMsg], rootDir);
  runGit(['push', 'origin', 'main'], rootDir);
  console.log('✓ Repozytorium ostrze zostało zaktualizowane i wypchnięte na origin/main.\n');
} else {
  console.log('✓ Brak zmian do zacommitowania w projekcie ostrze.\n');
}

console.log('=== Gotowe! Oba repozytoria są zsynchronizowane. ===\n');
