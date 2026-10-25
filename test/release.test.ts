import { describe, expect, it } from 'vitest'
import {
  bumpVersion,
  extractChangelogSection,
  insertChangelogSection,
  nextUnpublishedPatch,
  planRelease,
  releaseNoteEntries
} from '../scripts/release-utils'

describe('release versions', () => {
  it('bumps versions', () => {
    expect(bumpVersion('0.0.1', 'patch')).toBe('0.0.2')
    expect(bumpVersion('0.3.9', 'minor')).toBe('0.4.0')
    expect(bumpVersion('1.2.3', 'major')).toBe('2.0.0')
    expect(() => bumpVersion('1.0.0-beta.1', 'patch')).toThrow(/Unsupported version/)
  })

  it('skips patch versions that are already published', () => {
    expect(nextUnpublishedPatch('1.0.5', ['1.0.5', '1.0.6', '1.0.7'])).toBe('1.0.8')
    expect(nextUnpublishedPatch('0.0.1', ['0.0.1', '1.0.7'])).toBe('0.0.2')
  })

  it('publishes an unpublished version as is, then uses changesets or a patch bump', () => {
    const published = ['1.0.0', '1.0.7']
    expect(planRelease('0.0.1', published, false)).toEqual({ kind: 'current', version: '0.0.1' })
    expect(planRelease('0.0.1', published, true)).toEqual({ kind: 'current', version: '0.0.1' })
    expect(planRelease('0.0.1', [...published, '0.0.1'], true)).toEqual({ kind: 'changesets' })
    expect(planRelease('0.0.1', [...published, '0.0.1'], false)).toEqual({ kind: 'patch', version: '0.0.2' })
  })
})

describe('release changelog', () => {
  const changelog = '# tably-react\n\n## 0.0.1\n\nFirst release.\n\n### Features\n\n- Tables.\n'

  it('inserts a new section under the heading', () => {
    const updated = insertChangelogSection(changelog, '0.0.2', ['Fix sorting', 'Speed up filtering'])
    expect(updated).toBe(
      '# tably-react\n\n## 0.0.2\n\n### Patch Changes\n\n- Fix sorting\n- Speed up filtering\n\n## 0.0.1\n\nFirst release.\n\n### Features\n\n- Tables.\n'
    )
    expect(insertChangelogSection(changelog, '0.0.2', [])).toContain('- Maintenance release.')
  })

  it('extracts a version section for release notes', () => {
    const updated = insertChangelogSection(changelog, '0.0.2', ['Fix sorting'])
    expect(extractChangelogSection(updated, '0.0.2')).toBe('### Patch Changes\n\n- Fix sorting')
    expect(extractChangelogSection(updated, '0.0.1')).toBe('First release.\n\n### Features\n\n- Tables.')
    expect(extractChangelogSection(updated, '9.9.9')).toBe('')
  })

  it('leaves release and merge commits out of the notes', () => {
    expect(
      releaseNoteEntries(['Fix sorting', 'Release v0.0.2 [skip ci]', 'Merge pull request #3 from x/y', '', ' Add pinning '])
    ).toEqual(['Fix sorting', 'Add pinning'])
  })
})
