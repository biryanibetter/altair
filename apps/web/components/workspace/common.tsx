'use client'
import { useState, type ReactNode } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/client/api'

export function ErrorMessage({ error }: { error: unknown }) { return error ? <div className="error-message" role="alert">{error instanceof Error ? error.message : String(error)}</div> : null }
export function Empty({ children }: { children: ReactNode }) { return <div className="empty-state">{children}</div> }
export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) { return <section className="region"><header><h2>{title}</h2>{action}</header><div className="region-body">{children}</div></section> }
export function Heading({ title, description, children }: { title: string; description: string; children?: ReactNode }) { return <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div><div className="actions">{children}</div></div> }
export function Tag({ children, tone = '' }: { children: ReactNode; tone?: string }) { return <span className={`tag ${tone}`}>{children}</span> }
export function Facts({ entries }: { entries: [string, ReactNode][] }) { return <dl className="facts">{entries.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value ?? 'Not recorded'}</dd></div>)}</dl> }
export function Evidence({ value, title = 'Evidence & calculation details' }: { value: unknown; title?: string }) { return <details className="evidence"><summary>{title}</summary><pre>{JSON.stringify(value, null, 2)}</pre></details> }
export const shortId = (id: string) => id.slice(0, 8).toUpperCase()
export const date = (value?: string | null) => value ? new Date(value).toLocaleString() : 'Not recorded'
export type Field = { key: string; label: string; type?: string; options?: { value: string; label: string }[]; value?: string; required?: boolean; hint?: string }
export function FormFields({ fields }: { fields: Field[] }) { return <div className="form-grid">{fields.map(field => <label key={field.key} className={field.type === 'textarea' ? 'wide' : ''}>{field.type === 'hidden' ? <input name={field.key} type="hidden" defaultValue={field.value} /> : <><span>{field.label}</span>{field.options ? <select name={field.key} defaultValue={field.value ?? ''} required={field.required ?? true}><option value="">Select…</option>{field.options.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select> : field.type === 'textarea' ? <textarea name={field.key} defaultValue={field.value} rows={5} required={field.required ?? true} /> : <input name={field.key} type={field.type ?? 'text'} defaultValue={field.value} required={field.required ?? true} step="any" />}{field.hint ? <small>{field.hint}</small> : null}</>}</label>)}</div> }
export function ActionForm<T>({ title, description, fields, path, method = 'POST', input, output, build, onSuccess, label = title }: { title: string; description: string; fields: Field[]; path: string | ((form: FormData) => string); method?: string; input: z.ZodType; output: z.ZodType<T>; build: (form: FormData) => unknown; onSuccess: (data: T) => void; label?: string }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(null)
  return <><Button variant="outline" onClick={() => { setError(null); setOpen(true) }}>{label}</Button><Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value) }}><DialogContent className="action-dialog"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><form onSubmit={async event => { event.preventDefault(); if (busy) return; const form = new FormData(event.currentTarget); setError(null); setBusy(true); try { const body = input.parse(build(form)); const data = await api(typeof path === 'function' ? path(form) : path, output, { method, body }); onSuccess(data); setOpen(false) } catch (e) { setError(e instanceof z.ZodError ? new Error(e.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')) : e) } finally { setBusy(false) } }}><FormFields fields={fields} /><ErrorMessage error={error} /><div className="form-actions"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : title}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button></div></form></DialogContent></Dialog></>
}
export function ResultAction({ title, path, method = 'POST', body, onSuccess }: { title: string; path: string; method?: string; body?: unknown; onSuccess?: (value: unknown) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(null)
  return <div><Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); setError(null); try { const result = await api(path, z.unknown(), { method, body }); onSuccess?.(result) } catch (e) { setError(e) } finally { setBusy(false) } }}>{busy ? 'Working…' : title}</Button><ErrorMessage error={error} /></div>
}
