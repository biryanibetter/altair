import { supplierCatalogSchema, supplierSearchSchema, supplierSearchResponseSchema } from '@altair/shared/contracts'
import type { z } from 'zod'

export function matchSuppliers(raw: unknown[], input: z.input<typeof supplierSearchSchema>, evaluatedAt: string) {
  const query = supplierSearchSchema.parse(input)
  const matches = raw.map(s => supplierCatalogSchema.parse(s)).filter(s => s.verificationStatus !== 'rejected' && (!query.countryCodes.length || s.countryCode !== null && query.countryCodes.includes(s.countryCode)) && (!query.locationId || s.locationId === query.locationId)).flatMap(s => {
    const products = s.products.filter(p => (!query.productId || p.productId === query.productId) && (!query.hsCode || p.classification === query.classification && p.hsCode?.startsWith(query.hsCode)))
    const capabilities = query.capabilities.map(c => s.capabilities.find(p => p.name.toLowerCase() === c.toLowerCase()))
    if ((query.productId || query.hsCode) && !products.length || capabilities.some(c => !c)) return []
    const evidenceIds = [...products.map(p => p.evidenceId), ...capabilities.flatMap(c => c ? [c.evidenceId] : [])]
    const relevant = s.evidence.filter(e => evidenceIds.includes(e.id))
    const fresh = (e: typeof relevant[number]) => e.status === 'confirmed' && Date.parse(e.observedAt) <= Date.parse(evaluatedAt) && Date.parse(e.expiresAt) > Date.parse(evaluatedAt)
    const verified = s.verificationStatus === 'verified' && !!s.verifiedAt && Date.parse(s.verifiedAt) <= Date.parse(evaluatedAt) && !!s.expiresAt && Date.parse(s.expiresAt) > Date.parse(evaluatedAt)
    const confirmed = verified && (!query.productId && !query.hsCode || products.some(p => relevant.some(e => e.id === p.evidenceId && fresh(e)))) && capabilities.every(c => relevant.some(e => e.id === c?.evidenceId && fresh(e)))
    return [{ id: s.id, name: s.name, countryCode: s.countryCode, matchStatus: confirmed ? 'confirmed_catalog_match' as const : 'potential_match' as const, availability: 'unverified' as const, score: (confirmed ? 100 : 0) + (query.productId ? 30 : 0) + (query.hsCode ? 20 : 0) + query.capabilities.length * 5, reasons: [verified ? 'supplier_verification_current' : 'supplier_unverified_or_outdated', ...(query.hsCode ? ['hs_prefix_match_same_classification'] : []), ...(!confirmed ? ['match_requires_fresh_confirmed_evidence'] : []), 'catalog_match_is_not_stock_or_fulfillment_confirmation'], evidence: relevant }]
  }).sort((a, b) => a.id.localeCompare(b.id))
  // Stable UUID pagination; score is explanatory, never an availability ranking.
  const remaining = matches.filter(s => !query.cursor || s.id > query.cursor), data = remaining.slice(0, query.limit)
  return supplierSearchResponseSchema.parse({ version: 'supply-1.0.0', evaluatedAt, data, nextCursor: remaining.length > query.limit ? data.at(-1)!.id : null, limitations: ['catalog_coverage_not_exhaustive', 'availability_and_order_fulfillment_require_private_current_verification', 'score_is_matching_index_not_probability'] })
}
