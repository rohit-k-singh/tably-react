// Prepares the next release on CI: decides the version, updates package.json
// and CHANGELOG.md, and writes the release notes. Publishing, tagging and
// pushing happen in .github/workflows/release.yml.
//
// Usage: node scripts/release.ts [--dry-run]
import { execFileSync } from 'node:child_process'
import { appendFileSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  extractChangelogSection,
  insertChangelogSection,
  planRelease,
  RELEASE_PATHS,
  releaseNoteEntries
} from './release-utils.ts'

const dryRun = process.argv.includes('--dry-run')
const root = join(import.meta.dirname, '..')
const packagePath = join(root, 'package.json')
const changelogPath = join(root, 'CHANGELOG.md')

const run = (command: string, args: string[]) =>
  execFileSync(command, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim()

const readPackage = () => JSON.parse(readFileSync(packagePath, 'utf8')) as { name: string; version: string }

function publishedVersions(name: string): string[] {
  try {
    const output = run('npm', ['view', name, 'versions', '--json'])
    const versions = JSON.parse(output || '[]')
    return Array.isArray(versions) ? versions : [versions]
  } catch {
    // Not published yet (404).
    return []
  }
}

function lastReleaseTag(): string | undefined {
  try {
    return run('git', ['describe', '--tags', '--abbrev=0', '--match', 'v*'])
  } catch {
    return undefined
  }
}

function commitSubjectsSince(tag: string | undefined): string[] {
  return run('git', ['log', tag ? `${tag}..HEAD` : 'HEAD', '--no-merges', '--pretty=%s']).split('\n')
}

function hasPackageChangesSince(tag: string | undefined): boolean {
  if (!tag) return true
  return run('git', ['diff', '--name-only', tag, 'HEAD', '--', ...RELEASE_PATHS]) !== ''
}

function output(key: string, value: string) {
  console.log(`${key}=${value}`)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`)
}

const pkg = readPackage()
const published = publishedVersions(pkg.name)
const lastTag = lastReleaseTag()
const changesets = readdirSync(join(root, '.changeset')).filter((file) => file.endsWith('.md') && file !== 'README.md')
const plan = planRelease(pkg.version, published, changesets.length > 0)
console.log(`Current ${pkg.version}; ${published.length} published versions; ${changesets.length} changesets → ${plan.kind}`)

// An unpublished version is always released; otherwise only when the package itself changed.
if (plan.kind !== 'current' && !hasPackageChangesSince(lastTag)) {
  console.log(`No changes to ${RELEASE_PATHS.join(', ')} since ${lastTag}: nothing to release.`)
  output('version', '')
  process.exit(0)
}

if (dryRun) {
  console.log(plan.kind === 'changesets' ? 'Would run `changeset version`.' : `Would release ${plan.version}.`)
  process.exit(0)
}

let version: string
if (plan.kind === 'current') {
  version = plan.version
} else if (plan.kind === 'changesets') {
  run('npx', ['changeset', 'version'])
  version = readPackage().version
  if (published.includes(version)) {
    throw new Error(`Changesets produced ${version}, which is already published. Bump package.json past it.`)
  }
} else {
  version = plan.version
  run('npm', ['version', version, '--no-git-tag-version', '--allow-same-version'])
  const entries = releaseNoteEntries(commitSubjectsSince(lastTag))
  writeFileSync(changelogPath, insertChangelogSection(readFileSync(changelogPath, 'utf8'), version, entries))
}

const notesPath = join(process.env.RUNNER_TEMP ?? root, 'release-notes.md')
writeFileSync(notesPath, extractChangelogSection(readFileSync(changelogPath, 'utf8'), version) || `Release ${version}.`)

output('version', version)
output('changed', String(plan.kind !== 'current'))
output('notes', notesPath)
