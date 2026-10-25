// Pure helpers for scripts/release.ts, kept separate so they can be unit tested.

export type Bump = 'major' | 'minor' | 'patch'

/** Files whose changes make a new release: the published code, its build and its metadata. */
export const RELEASE_PATHS = ['src', 'package.json', 'tsup.config.ts', '.changeset', ':(exclude).changeset/README.md']

export type ReleasePlan =
  /** The version in package.json was never published: publish it as is. */
  | { kind: 'current'; version: string }
  /** Pending changesets decide the bump and write the changelog. */
  | { kind: 'changesets' }
  /** No changesets: publish the next free patch version. */
  | { kind: 'patch'; version: string }

const VERSION = /^(\d+)\.(\d+)\.(\d+)$/

export function parseVersion(version: string): [number, number, number] {
  const match = VERSION.exec(version)
  if (!match) throw new Error(`Unsupported version "${version}" (expected MAJOR.MINOR.PATCH).`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function bumpVersion(version: string, bump: Bump): string {
  const [major, minor, patch] = parseVersion(version)
  if (bump === 'major') return `${major + 1}.0.0`
  if (bump === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

/** The first patch version after `version` that is not published yet. */
export function nextUnpublishedPatch(version: string, published: readonly string[]): string {
  let next = bumpVersion(version, 'patch')
  while (published.includes(next)) next = bumpVersion(next, 'patch')
  return next
}

export function planRelease(current: string, published: readonly string[], hasChangesets: boolean): ReleasePlan {
  if (!published.includes(current)) return { kind: 'current', version: current }
  if (hasChangesets) return { kind: 'changesets' }
  return { kind: 'patch', version: nextUnpublishedPatch(current, published) }
}

/** Inserts a version section under the changelog's top-level heading. */
export function insertChangelogSection(changelog: string, version: string, entries: readonly string[]): string {
  const body = entries.length ? entries.map((entry) => `- ${entry}`).join('\n') : '- Maintenance release.'
  const section = `## ${version}\n\n### Patch Changes\n\n${body}\n`
  const lines = changelog.split('\n')
  const headingIndex = lines.findIndex((line) => line.startsWith('# '))
  if (headingIndex === -1) return `${section}\n${changelog}`
  const before = lines.slice(0, headingIndex + 1).join('\n')
  const after = lines.slice(headingIndex + 1).join('\n').replace(/^\n+/, '')
  return `${before}\n\n${section}\n${after}`
}

/** The changelog section of a version, without its heading, for release notes. */
export function extractChangelogSection(changelog: string, version: string): string {
  const lines = changelog.split('\n')
  const start = lines.findIndex((line) => line.trim() === `## ${version}`)
  if (start === -1) return ''
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '))
  return lines
    .slice(start + 1, end === -1 ? undefined : end)
    .join('\n')
    .trim()
}

/** Commit subjects for release notes, leaving out release commits and merge commits. */
export function releaseNoteEntries(subjects: readonly string[]): string[] {
  return subjects
    .map((subject) => subject.trim())
    .filter((subject) => subject && !/^Release v\d/.test(subject) && !/^Merge (pull request|branch)/.test(subject))
}
