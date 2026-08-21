import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const comments = read('src/components/comments/CommentSection.tsx')
const reports = read('src/components/comments/CommentReportForm.tsx')
const globals = read('src/app/globals.css')
const ranking = read('src/app/rankings/[rankingSlug]/page.tsx')
const item = read('src/app/items/[itemSlug]/page.tsx')

for (const contract of [
  'listComments({ targetType, targetId, limit: 20 })',
  'createComment({',
  'updateComment({',
  'deleteComment({',
  '<CommentReportForm',
  'router.push(`/login?next=${encodeURIComponent(pathname)}`)',
]) {
  assert.ok(comments.includes(contract), `comment interaction contract missing: ${contract}`)
}

for (const forbidden of [
  'border-white',
  'bg-black',
  'bg-slate-900',
  'text-slate-',
  'text-indigo-',
  'bg-indigo-',
]) {
  assert.ok(!comments.includes(forbidden), `comment surface must not use legacy dark utility: ${forbidden}`)
  assert.ok(!reports.includes(forbidden), `comment report surface must not use legacy dark utility: ${forbidden}`)
}

assert.ok(comments.includes('border-[#dfe3e8]'), 'comments must own the native public border surface')
assert.ok(comments.includes('bg-white'), 'comments must own the native public background surface')
assert.ok(comments.includes('text-[#303640]'), 'comments must own the native public text surface')
assert.ok(comments.includes('rw-button-primary'), 'primary comment submit must reuse the public button contract')
assert.ok(comments.includes('rw-button-secondary'), 'comment pagination must reuse the public secondary button contract')
assert.ok(comments.includes('aria-label="댓글 내용"'), 'comment composer must expose a textarea label')
assert.ok(comments.includes('aria-label="답글 내용"'), 'reply composer must expose a textarea label')
assert.ok(comments.includes('aria-label="댓글 수정 내용"'), 'comment editor must expose a textarea label')
assert.ok(comments.includes('role="alert"'), 'comment errors must expose an alert role')
assert.ok(comments.includes('aria-live="polite"'), 'comment success feedback must expose a polite live region')
assert.ok(comments.includes('role="status"'), 'comment loading state must expose a status role')

assert.ok(reports.includes('aria-label="댓글 신고 사유"'), 'report reason control must expose a label')
assert.ok(reports.includes('aria-label="댓글 신고 추가 설명"'), 'report detail control must expose a label')
assert.ok(reports.includes('bg-[#fff7f8]'), 'report form must use the native light danger surface')
assert.ok(reports.includes('text-[#a93449]'), 'report form must use the native danger text surface')
assert.ok(reports.includes("value: 'misinformation'"), 'existing misinformation report reason must remain available')

assert.ok(!globals.includes('.rw-comment-shell [class*='), 'global CSS must not translate legacy comment utilities')
assert.ok(!globals.includes('.rw-comment-shell #comments-heading'), 'global CSS must not patch comment heading color')
assert.ok(ranking.includes('<CommentSection targetType="ranking"'), 'ranking discussion must remain wired')
assert.ok(item.includes('<CommentSection targetType="item"'), 'item discussion must remain wired')
assert.ok(ranking.includes('rw-comment-shell'), 'ranking discussion wrapper must remain in article flow')
assert.ok(item.includes('rw-comment-shell'), 'item discussion wrapper must remain in article flow')

console.log('UI-2D native public discussion contracts verified.')
