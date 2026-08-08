import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');
const ghPagesDir = path.join(repoRoot, '.gh-pages-tmp');

const repoRemote = (() => {
  try {
    return execSync('git remote get-url origin', { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
})();

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || (repoRemote.includes('/') ? repoRemote.split('/').pop()?.replace(/\.git$/, '') : 'dwar');
const baseUrl = process.env.SITE_BASE_URL || (repoName ? `/${repoName}/` : '/');

process.env.SITE_BASE_URL = baseUrl;
process.env.GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || repoRemote || 'dwar';

const tempHome = path.join(repoRoot, '.gh-home');
fs.mkdirSync(tempHome, { recursive: true });
const env = {
  ...process.env,
  HOME: tempHome,
  GIT_CONFIG_GLOBAL: path.join(tempHome, '.gitconfig'),
};

console.log(`Building for GitHub Pages base: ${baseUrl}`);
execSync('npm run build', { cwd: repoRoot, stdio: 'inherit', env });

if (!fs.existsSync(distDir)) {
  throw new Error('Build output not found. Run npm run build first.');
}

if (fs.existsSync(ghPagesDir)) {
  fs.rmSync(ghPagesDir, { recursive: true, force: true });
}

fs.mkdirSync(ghPagesDir, { recursive: true });

for (const entry of fs.readdirSync(distDir)) {
  const src = path.join(distDir, entry);
  const dest = path.join(ghPagesDir, entry);
  fs.cpSync(src, dest, { recursive: true });
}

execSync('git init', { cwd: ghPagesDir, stdio: 'inherit', env });
execSync('git config user.name "GitHub Pages Deploy"', { cwd: ghPagesDir, stdio: 'inherit', env });
execSync('git config user.email "deploy@example.com"', { cwd: ghPagesDir, stdio: 'inherit', env });
execSync('git add .', { cwd: ghPagesDir, stdio: 'inherit', env });
execSync('git commit -m "Deploy to GitHub Pages"', { cwd: ghPagesDir, stdio: 'inherit', env });

if (repoRemote) {
  execSync(`git remote add origin ${repoRemote}`, { cwd: ghPagesDir, stdio: 'inherit', env });
} else {
  throw new Error('No Git remote found. Add an origin remote before deploying.');
}

try {
  execSync('git push --force origin HEAD:gh-pages', { cwd: ghPagesDir, stdio: 'inherit', env });
} catch (error) {
  console.error('Deployment push failed. Ensure GitHub authentication is available for the remote repository.');
  throw error;
}
