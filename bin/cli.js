#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const isGlobalPlugin = args.includes('--global') || args.includes('-g') || args.includes('--plugin');
const isClaude = args.includes('--claude');
const isCursor = args.includes('--cursor');

const srcRoot = path.resolve(__dirname, '..');
const cwd = process.cwd();

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    const base = path.basename(src);
    if (['.git', 'node_modules', 'public', '.tmp_promo_build', '__pycache__'].includes(base)) {
      return;
    }
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

console.log('\n==================================================================');
console.log('🎬  AUTO PROMO VIDEO — AI Skill & Plugin Installer (60FPS Studio)');
console.log('    Created by Hisyam Abilkhoir (Abyns Studio)');
console.log('==================================================================\n');

if (isGlobalPlugin) {
  // Install as an official Antigravity Global Plugin (~/.gemini/config/plugins/auto-promo-video)
  const pluginDir = path.join(os.homedir(), '.gemini', 'config', 'plugins', 'auto-promo-video');
  const skillDest = path.join(pluginDir, 'skills', 'auto-promo-video');

  fs.mkdirSync(pluginDir, { recursive: true });
  fs.copyFileSync(path.join(srcRoot, 'plugin.json'), path.join(pluginDir, 'plugin.json'));
  fs.copyFileSync(path.join(srcRoot, 'README.md'), path.join(pluginDir, 'README.md'));
  copyRecursiveSync(path.join(srcRoot, 'assets'), path.join(pluginDir, 'assets'));

  // Copy skill files into skills/auto-promo-video/
  fs.mkdirSync(skillDest, { recursive: true });
  fs.copyFileSync(path.join(srcRoot, 'SKILL.md'), path.join(skillDest, 'SKILL.md'));
  copyRecursiveSync(path.join(srcRoot, 'scripts'), path.join(skillDest, 'scripts'));
  copyRecursiveSync(path.join(srcRoot, 'remotion_app'), path.join(skillDest, 'remotion_app'));
  copyRecursiveSync(path.join(srcRoot, 'examples'), path.join(skillDest, 'examples'));

  console.log('✅ Berhasil diinstal sebagai GLOBAL PLUGIN Antigravity!');
  console.log(`📂 Lokasi Plugin : ${pluginDir}`);
  console.log('💡 Sekarang buka menu Customizations -> Plugins di Antigravity untuk melihatnya.\n');
} else {
  let targetSubdir = '.agent/skills/auto-promo-video';
  if (isClaude) targetSubdir = '.claude/skills/auto-promo-video';
  if (isCursor) targetSubdir = '.cursor/skills/auto-promo-video';

  const targetDir = path.join(cwd, targetSubdir);
  fs.mkdirSync(targetDir, { recursive: true });

  ['SKILL.md', 'README.md', 'LICENSE', '.gitignore'].forEach((file) => {
    if (fs.existsSync(path.join(srcRoot, file))) {
      fs.copyFileSync(path.join(srcRoot, file), path.join(targetDir, file));
    }
  });
  copyRecursiveSync(path.join(srcRoot, 'scripts'), path.join(targetDir, 'scripts'));
  copyRecursiveSync(path.join(srcRoot, 'remotion_app'), path.join(targetDir, 'remotion_app'));
  copyRecursiveSync(path.join(srcRoot, 'examples'), path.join(targetDir, 'examples'));

  console.log(`✅ Skill berhasil diinstal ke project Anda!`);
  console.log(`📂 Lokasi Skill : ${targetDir}`);
  console.log(`💡 Coba ketik di chat AI Agent Anda:`);
  console.log(`   "Buatkan video promosi 60 FPS untuk website https://..."\n`);
}

console.log('☕ Dukung kreator (Traktir Kopi via DANA): 085973729267\n');

