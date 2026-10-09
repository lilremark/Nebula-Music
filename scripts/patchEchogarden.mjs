import fs from 'node:fs/promises';
// Echogarden cache.path is for the voice list, not model packages. Keep this
// narrow, version-pinned patch so synthesis cannot fetch packages at runtime.
for (const suffix of ['dist/utilities/PackageManager.js', 'src/utilities/PackageManager.ts']) {
  const file = 'node_modules/echogarden/' + suffix;
  let source = await fs.readFile(file, 'utf8');
  if (source.includes('NEBULA_DJ_PACKAGES_DIR')) continue;
  const marker = source.includes('    const packageBaseURL') ? '    const packageBaseURL' : '\tconst packageBaseURL';
  source = source.replace(marker, "    if (process.env.NEBULA_DJ_PACKAGES_DIR) throw new Error('Bundled DJ resource missing: ' + packageName);\n" + marker);
  source = source.replace('const packagesPath = await ensureAndGetPackagesDir()', 'const packagesPath = process.env.NEBULA_DJ_PACKAGES_DIR || await ensureAndGetPackagesDir()');
  if (!source.includes('Bundled DJ resource missing')) throw new Error('Echogarden patch no longer matches.');
  await fs.writeFile(file, source);
}
