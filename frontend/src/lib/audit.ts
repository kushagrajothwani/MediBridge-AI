import type { AuditAction, AuditEvent } from '../types';

export const ACTION_LABEL: Record<AuditAction, string> = {
  view_records: 'Viewed records',
  access_denied: 'Access denied',
  consent_requested: 'Asked for access',
  consent_granted: 'Access granted',
  consent_rejected: 'Request declined',
  consent_revoked: 'Access revoked',
  ai_summary: 'AI summary generated',
  record_upload: 'Record uploaded',
  emergency_access: 'Emergency access used',
};

export const ACTION_TONE: Record<AuditAction, 'ok' | 'warn' | 'bad' | 'info' | 'neutral'> = {
  view_records: 'neutral',
  access_denied: 'bad',
  consent_requested: 'info',
  consent_granted: 'ok',
  consent_rejected: 'neutral',
  consent_revoked: 'warn',
  ai_summary: 'info',
  record_upload: 'neutral',
  emergency_access: 'bad',
};

/** One-line sentence for activity lists. */
export function sentence(e: AuditEvent, hospitalName: string): string {
  const who = e.actorHospitalId ? `${e.actorName} (${hospitalName})` : e.actorName;
  switch (e.action) {
    case 'view_records': return `${who} viewed records.`;
    case 'access_denied': return `${who} tried to open ${e.resource} without permission and was blocked.`;
    case 'consent_requested': return `${who} asked for access to records.`;
    case 'consent_granted': return `${who} granted access.`;
    case 'consent_rejected': return `${who} declined an access request.`;
    case 'consent_revoked': return `${who} revoked access.`;
    case 'ai_summary': return `${who} generated an AI summary.`;
    case 'record_upload': return `${who} added ${e.resource}.`;
    case 'emergency_access': return `${who} used emergency access.`;
  }
}
