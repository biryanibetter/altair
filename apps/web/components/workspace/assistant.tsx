'use client'
import { useState } from 'react'
import { z } from 'zod'
import { assistantResponseSchema } from '@altair/shared/contracts'
import { api } from '@/lib/client/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ErrorMessage, Evidence, Tag } from './common'

type Response = z.infer<typeof assistantResponseSchema>
type Turn = { question: string; response: Response }

export function Assistant({ open, onOpenChange, context }: { open: boolean; onOpenChange: (open: boolean) => void; context: string }) {
  const [turns, setTurns] = useState<Turn[]>([]), [conversationId, setConversationId] = useState<string>(), [draft, setDraft] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(null)
  const send = async (message: string, approvedToolInputs: Response['pendingToolRequests'] = []) => {
    if (!message.trim() || busy) return
    setBusy(true); setError(null)
    try {
      const response = await api('/assistant/chat', assistantResponseSchema, { method: 'POST', body: { message, ...(conversationId ? { conversationId } : {}), allowSimulationCreation: false, approvedToolInputs } })
      setTurns(current => [...current, { question: message, response }])
      if (response.conversationId) setConversationId(response.conversationId)
      setDraft('')
    } catch (e) { setError(e) } finally { setBusy(false) }
  }
  const latest = turns.at(-1)?.response
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="assistant-dialog">
    <DialogTitle>ALTAIR assistant</DialogTitle>
    <DialogDescription>Context: {context}. Answers cite tool output and never invent operational records.</DialogDescription>
    <div className="assistant-transcript">
      {turns.length === 0 ? <div className="assistant-empty"><p>Ask about routes, inventory coverage, supplier evidence or a recorded shipment.</p><small>Tool calls are limited to approved comparisons, forecasts, simulations and dependency imports. Simulation creation requires explicit approval.</small></div> : turns.map((turn, index) => <div className="turn" key={`${turn.response.turnId ?? index}`}><p className="question">{turn.question}</p><p className="explanation">{turn.response.explanation}</p><Tag tone={turn.response.status === 'degraded' ? 'warn' : ''}>{turn.response.status}</Tag>{turn.response.findings.length ? <dl className="findings">{turn.response.findings.map((finding, i) => <div key={`${finding.kind}-${i}`}><dt>{finding.kind.replaceAll('_', ' ')}</dt><dd>{String(finding.value)}{finding.explanation ? <small>{finding.explanation}</small> : null}</dd></div>)}</dl> : null}{turn.response.recommendations.length ? <ul className="compact-list">{turn.response.recommendations.map((recommendation, i) => <li key={i}>{recommendation.text}<small>{recommendation.action.replaceAll('_', ' ')} · evidence {recommendation.evidenceIds.join(', ')}</small></li>)}</ul> : null}{turn.response.limitations.length ? <ul className="compact-list limitations">{turn.response.limitations.map(l => <li key={l}>{l}</li>)}</ul> : null}{turn.response.errors.length ? <div className="notice">{turn.response.errors.map((e, i) => <p key={i}>{e.tool ? `${e.tool}: ` : ''}{e.code.replaceAll('_', ' ')}{e.retryAfterSeconds ? ` — retry after ${e.retryAfterSeconds}s` : ''}</p>)}</div> : null}{turn.response.pendingToolRequests.length ? <div className="pending-tools"><p>This answer requires tool approval before it can continue.</p>{turn.response.pendingToolRequests.map((request, i) => <div key={i}><span className="mono">{request.tool}</span><pre>{JSON.stringify(request.arguments, null, 2)}</pre></div>)}<Button variant="outline" disabled={busy} onClick={() => send(turn.question, turn.response.pendingToolRequests)}>Approve and continue</Button></div> : null}{turn.response.evidence.length ? <Evidence title="Evidence used" value={turn.response.evidence} /> : null}</div>)}
    </div>
    <ErrorMessage error={error} />
    <form className="assistant-compose" onSubmit={event => { event.preventDefault(); void send(draft) }}><textarea aria-label="Ask the assistant" value={draft} onChange={e => setDraft(e.target.value)} rows={2} placeholder="e.g. Compare sea and air options for the next shipment" maxLength={8000} /><div><span className="muted small">{draft.length}/8000</span><Button type="submit" disabled={busy || !draft.trim()}>{busy ? 'Thinking…' : 'Send'}</Button>{turns.length ? <Button type="button" variant="ghost" onClick={() => { setTurns([]); setConversationId(undefined); setDraft(''); setError(null) }}>New conversation</Button> : null}</div></form>
    {latest ? <p className="muted small">Assessments are grounded in the tools that ran. No booking, customs filing or legal determination is performed.</p> : null}
  </DialogContent></Dialog>
}
