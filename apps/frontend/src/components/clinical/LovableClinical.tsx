import React, { type ReactNode } from 'react';
import { AlertOctagon, AlertTriangle, Info } from 'lucide-react';
import styles from './LovableClinical.module.css';

/* ------------------------------------------------------------- Patient Identification */

export interface PatientIdentityProps {
  name: string;
  mrn: string;
  age?: number | string;
  gender?: string;
  bloodGroup?: string;
  department?: string;
  compact?: boolean;
}

export function PatientIdentity({
  name,
  mrn,
  age,
  gender,
  bloodGroup,
  department,
  compact = false,
}: PatientIdentityProps) {
  const genderLabel = gender === 'M' || gender === 'male' ? 'Male' : gender === 'F' || gender === 'female' ? 'Female' : gender;
  return (
    <div className={styles.patientIdentity}>
      <div className={styles.nameRow}>
        <span className={compact ? styles.compactName : styles.fullName}>{name}</span>
        <span className={`num ${styles.mrnBadge}`}>{mrn}</span>
      </div>
      <p className={styles.metaRow}>
        {age ? `${age} yrs` : ''}
        {age && genderLabel ? ' · ' : ''}
        {genderLabel ?? ''}
        {(age || genderLabel) && bloodGroup ? ` · ${bloodGroup}` : bloodGroup ? bloodGroup : ''}
        {(age || genderLabel || bloodGroup) && department ? ` · ${department}` : department ? department : ''}
      </p>
    </div>
  );
}

export interface PatientAlert {
  level: 'critical' | 'warning' | 'info';
  label: string;
}

export function PatientAlerts({ alerts }: { alerts: PatientAlert[] }) {
  if (!alerts || alerts.length === 0) {
    return (
      <span className={styles.noAlertsBadge}>
        <Info size={12} aria-hidden="true" />
        No known allergies
      </span>
    );
  }

  return (
    <ul className={styles.alertsList} aria-label="Patient alerts">
      {alerts.map((a, idx) => {
        const Icon = a.level === 'critical' ? AlertOctagon : a.level === 'warning' ? AlertTriangle : Info;
        const alertCls =
          a.level === 'critical'
            ? styles.alertCritical
            : a.level === 'warning'
              ? styles.alertWarning
              : styles.alertInfo;
        return (
          <li key={idx} className={`${styles.alertItem} ${alertCls}`}>
            <Icon size={12} aria-hidden="true" />
            <span className="sr-only">{a.level} alert: </span>
            {a.label}
          </li>
        );
      })}
    </ul>
  );
}

/** Persistent patient banner for clinical pages. */
export function PatientHeader({
  patient,
  alerts = [],
  actions,
}: {
  patient: PatientIdentityProps;
  alerts?: PatientAlert[];
  actions?: ReactNode;
}) {
  return (
    <div className={`clinical-panel ${styles.patientBanner}`}>
      <PatientIdentity {...patient} />
      <div className={styles.alertsContainer}>
        <PatientAlerts alerts={alerts} />
      </div>
      {actions ? <div className={styles.actionsContainer}>{actions}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------- Lab & Diagnostics Safety */

export function ReferenceRange({ low, high, unit }: { low: string | number; high: string | number; unit: string }) {
  return (
    <span className={`num ${styles.refRange}`}>
      ref {low}–{high} {unit}
    </span>
  );
}

export function ResultStatusFlag({ flag }: { flag: 'normal' | 'abnormal' | 'critical' | string }) {
  if (flag === 'normal') {
    return <span className={styles.statusNormal}>Within range</span>;
  }
  const isCritical = flag === 'critical';
  return (
    <span className={`${styles.flagBadge} ${isCritical ? styles.flagCritical : styles.flagWarning}`}>
      {isCritical ? <AlertOctagon size={12} aria-hidden="true" /> : <AlertTriangle size={12} aria-hidden="true" />}
      {isCritical ? 'CRITICAL' : 'Abnormal'}
    </span>
  );
}

export function LabValueRow({
  analyte,
  value,
  unit,
  low,
  high,
  flag,
}: {
  analyte: string;
  value: string | number;
  unit: string;
  low: string | number;
  high: string | number;
  flag: 'normal' | 'abnormal' | 'critical';
}) {
  const isCritical = flag === 'critical';
  return (
    <tr className={isCritical ? styles.rowCritical : undefined}>
      <th scope="row" className={styles.analyteCell}>
        {analyte}
      </th>
      <td className={`num ${styles.valueCell}`}>
        {value} <span className={styles.unitText}>{unit}</span>
      </td>
      <td className={styles.rangeCell}>
        <ReferenceRange low={low} high={high} unit={unit} />
      </td>
      <td className={styles.statusCell}>
        <ResultStatusFlag flag={flag} />
      </td>
    </tr>
  );
}

export function CriticalResultBanner({
  analyte,
  testName,
  parameter,
  value,
  unit = '',
  patientName,
  mrn,
  referenceRange,
  acknowledged = false,
  onAcknowledge,
  action,
}: {
  analyte?: string;
  testName?: string;
  parameter?: string;
  value?: string | number;
  unit?: string;
  patientName?: string;
  mrn?: string;
  referenceRange?: string;
  acknowledged?: boolean;
  onAcknowledge?: () => void;
  action?: ReactNode;
}) {
  const titleText = testName ?? parameter ?? analyte ?? 'Critical Diagnostic Flag';
  return (
    <div role="alert" className={`clinical-panel ${styles.criticalBanner}`}>
      <AlertOctagon size={24} className={styles.criticalIcon} aria-hidden="true" />
      <div className={styles.criticalContent}>
        <p className={styles.criticalTitle}>
          CRITICAL VALUE ALERT — {titleText} {value ? `${value} ${unit}` : ''}
        </p>
        <p className={styles.criticalMeta}>
          {patientName ? `${patientName} · ` : ''}
          {mrn ? <span className="num">{mrn} · </span> : null}
          {referenceRange ? `Ref: ${referenceRange} · ` : ''}
          Requires mandatory physician review and deterministic acknowledgment.
        </p>
      </div>
      {onAcknowledge && !acknowledged ? (
        <div className={styles.criticalAction}>
          <button
            type="button"
            className={styles.ackButton}
            onClick={onAcknowledge}
          >
            Acknowledge Critical Result
          </button>
        </div>
      ) : action ? (
        <div className={styles.criticalAction}>{action}</div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- Clinical Panels & Vitals */

export function ClinicalSection({
  title,
  description,
  children,
  actions,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`clinical-panel ${styles.clinicalSection} ${className ?? ''}`} aria-label={title}>
      <header className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>{title}</h2>
          {description ? <p className={styles.sectionDescription}>{description}</p> : null}
        </div>
        {actions ? <div className={styles.sectionActions}>{actions}</div> : null}
      </header>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

export function ClinicalField({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className={styles.fieldContainer}>
      <dt className={styles.fieldLabel}>{label}</dt>
      <dd className={`${styles.fieldValue} ${mono ? 'num' : ''}`}>{value ?? '—'}</dd>
    </div>
  );
}

export interface VitalSign {
  label: string;
  value: string | number;
  unit: string;
  range?: string;
  flag?: 'normal' | 'abnormal';
}

export function VitalsPanel({ vitals }: { vitals: VitalSign[] }) {
  if (!vitals || vitals.length === 0) {
    return <p className={styles.noVitals}>No vital sign observations recorded.</p>;
  }

  return (
    <dl className={styles.vitalsGrid}>
      {vitals.map((v, idx) => (
        <div
          key={idx}
          className={`${styles.vitalCard} ${v.flag === 'abnormal' ? styles.vitalAbnormal : ''}`}
        >
          <dt className={styles.vitalLabel}>{v.label}</dt>
          <dd className={`num ${styles.vitalValue}`}>
            {v.value}
            <span className={styles.vitalUnit}>{v.unit}</span>
          </dd>
          {v.range ? <p className={`num ${styles.vitalRef}`}>ref {v.range}</p> : null}
          {v.flag === 'abnormal' ? (
            <span className={styles.vitalAbnormalTag}>
              <AlertTriangle size={10} aria-hidden="true" /> Abnormal
            </span>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

export function AcuityBadge({ acuity }: { acuity?: 'Critical' | 'Urgent' | 'Routine' | string }) {
  if (!acuity) return null;
  const isCritical = acuity.toLowerCase() === 'critical';
  const isUrgent = acuity.toLowerCase() === 'urgent';
  return (
    <span
      className={`${styles.acuityBadge} ${
        isCritical ? styles.acuityCritical : isUrgent ? styles.acuityUrgent : styles.acuityRoutine
      }`}
    >
      {isCritical ? <AlertOctagon size={12} aria-hidden="true" /> : isUrgent ? <AlertTriangle size={12} aria-hidden="true" /> : null}
      {acuity}
    </span>
  );
}
