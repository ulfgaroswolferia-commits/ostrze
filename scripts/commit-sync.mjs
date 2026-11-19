import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const rootDir = process.cwd();
const engineDir = path.join(rootDir, 'engine');

function run(cmd, cwd = rootDir) {
  return execSync(cmd, { cwd, stdio: 'inherit' });
}

function getOutput(cmd, cwd = rootDir) {
  return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'inherit'] }).trim();
}

const args = process.argv.slice(2).join(' ').trim();
const commitMsg = args || `chore: synchronized updates (game + engine ${new Date().toISOString().slice(0, 10)})`;

console.log(`\n=== Synchronizacja i commit (Gra + Silnik) ===`);
console.log(`Komunikat commitu: "${commitMsg}"\n`);

let engineUpdated = false;

// 1. Sprawdź i zacommituj silnik (submodule engine/)
if (fs.existsSync(engineDir)) {
  const engineStatus = getOutput('git status --porcelain', engineDir);
  if (engineStatus) {
    console.log('-> Wykryto zmiany w submodule silnika (engine/):');
    console.log(engineStatus);
    console.log('\n[1/2] Commitowanie i pushowanie silnika (engine/)...');
    run('git add -A', engineDir);
    run(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, engineDir);
    run('git push origin main', engineDir);
    engineUpdated = true;
    console.log('✓ Silnik zostal zaktualizowany i wypchniety na origin/main.\n');
  } else {
    console.log('✓ Submodule silnika (engine/) nie posiada lokalnych zmian roboczych.');
  }
} else {
  console.log('! Katalog engine/ nie istnieje. Pomijanie commitu w submodule.');
}

// 2. Sprawdź i zacommituj grę (ostrze)
const gameStatus = getOutput('git status --porcelain', rootDir);
if (gameStatus || engineUpdated) {
  console.log('\n[2/2] Commitowanie i pushowanie gry (ostrze)...');
  run('git add -A', rootDir);
  run(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, rootDir);
  run('git push origin main', rootDir);
  console.log('✓ Repozytorium ostrze zostalo zaktualizowane i wypchniete na origin/main.\n');
} else {
  console.log('✓ Brak zmian do zacommitowania w projekcie ostrze.\n');
}

console.log('=== Gotowe! Oba repozytoria sa zsynchronizowane. ===\n');
