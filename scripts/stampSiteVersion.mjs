// Points the homepage's download links and version badge at a release.
// Usage: node scripts/stampSiteVersion.mjs <version|vVersion> [site/index.html]
// The Pages workflow runs this with the latest stable release before deploying.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SEMVER = String.raw`\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?`;

export function stampSiteVersion(html, version) {
  const v = String(version).replace(/^v/, '');
  if (!new RegExp(`^${SEMVER}$`).test(v)) throw new Error(`Not a release version: ${version}`);

  let downloads = 0;
  let badges = 0;
  const out = html
    .replace(
      new RegExp(`releases/download/v${SEMVER}/Nebula-${SEMVER}-`, 'g'),
      () => { downloads += 1; return `releases/download/v${v}/Nebula-${v}-`; },
    )
    .replace(
      new RegExp(`(<[^>]*\\bdata-version\\b[^>]*>)v${SEMVER}(<)`, 'g'),
      (_m, open, close) => { badges += 1; return `${open}v${v}${close}`; },
    );

  if (downloads === 0) throw new Error('No release download links found to stamp');
  return { html: out, downloads, badges };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [version, file = 'site/index.html'] = process.argv.slice(2);
  if (!version) {
    console.error('Usage: node scripts/stampSiteVersion.mjs <version> [file]');
    process.exit(1);
  }
  const { html, downloads, badges } = stampSiteVersion(readFileSync(file, 'utf8'), version);
  writeFileSync(file, html);
  console.log(`Stamped ${file} with v${version.replace(/^v/, '')}: ${downloads} download links, ${badges} version badges`);
}
