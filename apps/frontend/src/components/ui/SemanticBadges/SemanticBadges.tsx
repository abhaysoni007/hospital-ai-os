import React from 'react';
import { AlertTriangle, Zap } from 'lucide-react';
import { Badge, BadgeSize } from '../Badge/Badge';
import {
  appointmentStatusMeta,
  encounterStatusMeta,
  orderStatusMeta,
  priorityMeta,
  recordStatusMeta,
  resultStatusMeta,
} from '../../../utils/statusMeta';

/**
 * M13 — Semantic status badges. Each wrapper resolves the frozen backend enum
 * through utils/statusMeta so label + variant stay consistent product-wide.
 */

function SemanticBadge({
  meta,
  size = 'md',
  icon,
}: {
  meta: { label: string; variant: Parameters<typeof Badge>[0]['variant'] };
  size?: BadgeSize;
  icon?: React.ReactNode;
}) {
  return (
    <Badge variant={meta.variant} size={size} showDot={meta.variant === 'critical'} icon={icon}>
      {meta.label}
    </Badge>
  );
}

export function AppointmentStatusBadge({ status, size }: { status: string; size?: BadgeSize }) {
  return <SemanticBadge meta={appointmentStatusMeta(status)} size={size} />;
}

export function EncounterStatusBadge({ status, size }: { status: string; size?: BadgeSize }) {
  return <SemanticBadge meta={encounterStatusMeta(status)} size={size} />;
}

export function OrderStatusBadge({ status, size }: { status: string; size?: BadgeSize }) {
  return <SemanticBadge meta={orderStatusMeta(status)} size={size} />;
}

export function ResultStatusBadge({ status, size }: { status: string; size?: BadgeSize }) {
  return <SemanticBadge meta={resultStatusMeta(status)} size={size} />;
}

/** STAT is unmistakable without relying on color alone (icon + text + dot). */
export function PriorityBadge({ priority, size }: { priority: string; size?: BadgeSize }) {
  const meta = priorityMeta(priority);
  const icon =
    priority === 'stat' ? (
      <Zap size={11} aria-hidden="true" />
    ) : priority === 'urgent' ? (
      <AlertTriangle size={11} aria-hidden="true" />
    ) : undefined;
  return <SemanticBadge meta={meta} size={size} icon={icon} />;
}

export function RecordStatusBadge({ status, size }: { status: string; size?: BadgeSize }) {
  return <SemanticBadge meta={recordStatusMeta(status)} size={size} />;
}
