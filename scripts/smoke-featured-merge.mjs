#!/usr/bin/env node
/**
 * Pure-logic smoke: verifies the "Feature on Homepage" merge algorithm
 * that is duplicated between Home.jsx (sports lanes) and
 * LiveEventsSection.jsx (concerts/arts/family). Both call sites
 * implement the same rule:
 *
 *   1. Sort featured events by numeric featuredOrder asc.
 *   2. Dedupe natural pool against featured ids.
 *   3. Concat [featured, ...dedupedNatural].
 *   4. Downstream slice to the section's Homepage Display Limit —
 *      so featuring one event pushes the tail card off the end
 *      rather than replacing the whole lane.
 *
 * This script re-implements the helper inline and exercises every
 * case the spec calls out. Running it as a node script keeps it in
 * the same shape as the rest of scripts/smoke-*.mjs and avoids
 * pulling in a full test framework for one algorithm.
 */

function mergeFeaturedThenNatural(featured, natural) {
  const naturalArr = Array.isArray(natural) ? natural : []
  if (!Array.isArray(featured) || featured.length === 0) return naturalArr
  const sorted = featured.slice().sort((a, b) => {
    const ao = Number(a?.featuredOrder)
    const bo = Number(b?.featuredOrder)
    const aHas = Number.isFinite(ao)
    const bHas = Number.isFinite(bo)
    if (aHas && bHas) return ao - bo
    if (aHas) return -1
    if (bHas) return 1
    return 0
  })
  const featuredIds = new Set(sorted.map((e) => e?.id).filter(Boolean))
  const deduped = naturalArr.filter((e) => e?.id && !featuredIds.has(e.id))
  return [...sorted, ...deduped]
}

let passed = 0
let failed = 0

function check(name, actualIds, expectedIds) {
  const a = actualIds.join(',')
  const e = expectedIds.join(',')
  if (a === e) {
    console.log(`  ok  ${name}`)
    passed++
  } else {
    console.log(`  FAIL ${name}`)
    console.log(`       expected: [${e}]`)
    console.log(`       actual:   [${a}]`)
    failed++
  }
}

// Fixture: automatic pool A..H (spec example).
const natural = [
  { id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' },
  { id: 'E' }, { id: 'F' }, { id: 'G' }, { id: 'H' },
]
const LIMIT = 8

console.log('featured-merge smoke:')

// Case 1 — spec example: single featured X (order 1).
// Expected result after slice: X,A,B,C,D,E,F,G. H rolls off.
{
  const featured = [{ id: 'X', featuredOrder: 1 }]
  const merged = mergeFeaturedThenNatural(featured, natural).slice(0, LIMIT)
  check(
    'single featured prepends and pushes tail off',
    merged.map((e) => e.id),
    ['X', 'A', 'B', 'C', 'D', 'E', 'F', 'G'],
  )
}

// Case 2 — spec example: two featured X(1), Y(2).
// Expected: X,Y,A,B,C,D,E,F. G and H roll off.
{
  const featured = [
    { id: 'Y', featuredOrder: 2 },
    { id: 'X', featuredOrder: 1 },
  ]
  const merged = mergeFeaturedThenNatural(featured, natural).slice(0, LIMIT)
  check(
    'two featured are order-sorted and prepended',
    merged.map((e) => e.id),
    ['X', 'Y', 'A', 'B', 'C', 'D', 'E', 'F'],
  )
}

// Case 3 — dedup: featured C already lives in the natural pool.
// Expected: C,A,B,D,E,F,G,H (C promoted; not appearing twice).
{
  const featured = [{ id: 'C', featuredOrder: 1 }]
  const merged = mergeFeaturedThenNatural(featured, natural).slice(0, LIMIT)
  check(
    'featured that overlaps natural is deduped',
    merged.map((e) => e.id),
    ['C', 'A', 'B', 'D', 'E', 'F', 'G', 'H'],
  )
}

// Case 4 — empty featured: pure natural passthrough, no mutation.
{
  const merged = mergeFeaturedThenNatural([], natural).slice(0, LIMIT)
  check(
    'empty featured is a passthrough',
    merged.map((e) => e.id),
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  )
}

// Case 5 — featuredOrder mixed: some ordered, some missing.
// Ordered entries come first sorted asc, unordered after in stable order.
{
  const featured = [
    { id: 'Z' },                       // unordered
    { id: 'X', featuredOrder: 2 },
    { id: 'W' },                       // unordered
    { id: 'Y', featuredOrder: 1 },
  ]
  const merged = mergeFeaturedThenNatural(featured, natural).slice(0, LIMIT)
  check(
    'ordered before unordered; ordered sorted asc',
    merged.map((e) => e.id),
    ['Y', 'X', 'Z', 'W', 'A', 'B', 'C', 'D'],
  )
}

// Case 6 — slice at custom limit (e.g. 4). Ensures no accidental
// hard-coded 8; the render slice is the one that caps the lane.
{
  const featured = [{ id: 'X', featuredOrder: 1 }]
  const merged = mergeFeaturedThenNatural(featured, natural).slice(0, 4)
  check(
    'slice respects arbitrary display limit',
    merged.map((e) => e.id),
    ['X', 'A', 'B', 'C'],
  )
}

// Case 7 — non-array featured input is treated as empty. Guards
// against a broken hook returning undefined.
{
  const merged = mergeFeaturedThenNatural(undefined, natural).slice(0, LIMIT)
  check(
    'non-array featured is treated as empty',
    merged.map((e) => e.id),
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  )
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
