'use client';

import React, { useState } from 'react';
import {
  Calendar,
  Stethoscope,
  CheckSquare,
  AlertOctagon,
  Sparkles,
  ArrowUpRight,
  Clock,
  User,
  Plus,
  Shield,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ROLE_DISPLAY_NAMES } from '../../utils/rbac';
import { Card, CardHeader, CardContent } from '../ui/Card/Card';
import { Badge } from '../ui/Badge/Badge';
import { Button } from '../ui/Button/Button';
import { AlertBanner } from '../ui/Alert/AlertBanner';
import styles from './DashboardShell.module.css';

interface PatientQueueItem {
  id: string;
  token: string;
  patientName: string;
  mrn: string;
  ageGender: string;
  time: string;
  chiefComplaint: string;
  status: 'in-progress' | 'waiting' | 'completed' | 'urgent';
}

interface TaskItem {
  id: string;
  title: string;
  patient: string;
  dueTime: string;
  priority: 'critical' | 'urgent' | 'stable';
  completed: boolean;
}

const DEMO_PATIENTS: PatientQueueItem[] = [
  {
    id: '1',
    token: '#01',
    patientName: 'Eleanor Vance',
    mrn: 'HOS-92841',
    ageGender: '58F',
    time: '09:00 AM',
    chiefComplaint: 'Post-PCI acute chest heaviness, dyspnea',
    status: 'urgent',
  },
  {
    id: '2',
    token: '#02',
    patientName: 'Arthur Pendelton',
    mrn: 'HOS-88319',
    ageGender: '64M',
    time: '09:30 AM',
    chiefComplaint: 'Hypertension follow-up & medication review',
    status: 'in-progress',
  },
  {
    id: '3',
    token: '#03',
    patientName: 'Miriam Al-Mansoor',
    mrn: 'HOS-91204',
    ageGender: '42F',
    time: '10:00 AM',
    chiefComplaint: 'Palpitations, Holter monitor review',
    status: 'waiting',
  },
  {
    id: '4',
    token: '#04',
    patientName: 'David K. Miller',
    mrn: 'HOS-76492',
    ageGender: '71M',
    time: '08:30 AM',
    chiefComplaint: 'Post-CABG routine 30-day clearance',
    status: 'completed',
  },
];

const DEMO_TASKS: TaskItem[] = [
  {
    id: 't1',
    title: 'Acknowledge STAT Panic Potassium (6.2 mEq/L)',
    patient: 'Eleanor Vance (HOS-92841)',
    dueTime: 'Immediate',
    priority: 'critical',
    completed: false,
  },
  {
    id: 't2',
    title: 'Sign Discharge Summary & Care Plan',
    patient: 'David K. Miller (HOS-76492)',
    dueTime: '11:00 AM',
    priority: 'urgent',
    completed: false,
  },
  {
    id: 't3',
    title: 'Review Echocardiogram report',
    patient: 'Miriam Al-Mansoor (HOS-91204)',
    dueTime: '01:30 PM',
    priority: 'stable',
    completed: true,
  },
];

export function DashboardShell() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>(DEMO_TASKS);
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);

  const greetingName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email.split('@')[0] || 'Clinician';

  const roleTitle = user?.role ? ROLE_DISPLAY_NAMES[user.role] : 'Staff';

  const toggleTask = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const getStatusBadge = (status: PatientQueueItem['status']) => {
    switch (status) {
      case 'urgent':
        return (
          <Badge variant="critical" size="sm" showDot>
            STAT Attention
          </Badge>
        );
      case 'in-progress':
        return (
          <Badge variant="primary" size="sm" showDot>
            In Consultation
          </Badge>
        );
      case 'waiting':
        return (
          <Badge variant="pending" size="sm" showDot>
            Waiting
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="stable" size="sm" showDot>
            Completed
          </Badge>
        );
    }
  };

  return (
    <div className={styles.dashboardContainer}>
      {/* 1. Context & Operational Greeting Banner */}
      <div className={styles.greetingBanner}>
        <div className={styles.greetingText}>
          <h1 className={styles.greetingTitle}>Good morning, {greetingName}</h1>
          <p className={styles.greetingSubtitle}>
            {roleTitle} • Cardiology Department • 8 Active Encounters
          </p>
        </div>

        <div className={styles.greetingActions}>
          <Button variant="secondary" size="md" iconLeft={<Plus size={16} />}>
            New Encounter
          </Button>
          <Button variant="outline" size="md" iconLeft={<Shield size={16} />}>
            Emergency Override
          </Button>
        </div>
      </div>

      {/* 2. Priority Critical Alert Area */}
      {!isAlertDismissed && (
        <div className={styles.alertSection}>
          <AlertBanner
            severity="critical"
            title="CRITICAL LAB VALUE — IMMEDIATE CLINICAL ACTION REQUIRED"
            dismissible
            onDismiss={() => setIsAlertDismissed(true)}
            action={
              <Button variant="danger" size="sm" iconRight={<ArrowUpRight size={14} />}>
                Review Lab Order
              </Button>
            }
          >
            Patient <strong>Eleanor Vance (MRN: HOS-92841)</strong>: Potassium level at{' '}
            <strong>6.2 mEq/L</strong> (Normal: 3.5–5.0 mEq/L). Telemetry monitoring active in Bed
            402-B.
          </AlertBanner>
        </div>
      )}

      {/* 3. KPI Metrics Grid */}
      <div className={styles.kpiGrid}>
        <Card elevation="xs" padding="md" className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Today&apos;s Appointments</span>
            <div className={`${styles.kpiIconWrapper} ${styles.blue}`}>
              <Calendar size={18} />
            </div>
          </div>
          <div className={styles.kpiValue}>24</div>
          <div className={styles.kpiFooter}>
            <span className={styles.kpiSubtext}>8 remaining in queue</span>
          </div>
        </Card>

        <Card elevation="xs" padding="md" className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Active Encounters</span>
            <div className={`${styles.kpiIconWrapper} ${styles.indigo}`}>
              <Stethoscope size={18} />
            </div>
          </div>
          <div className={styles.kpiValue}>8</div>
          <div className={styles.kpiFooter}>
            <span className={styles.kpiSubtext}>3 in active consultation</span>
          </div>
        </Card>

        <Card elevation="xs" padding="md" className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Pending Tasks</span>
            <div className={`${styles.kpiIconWrapper} ${styles.amber}`}>
              <CheckSquare size={18} />
            </div>
          </div>
          <div className={styles.kpiValue}>6</div>
          <div className={styles.kpiFooter}>
            <span className={styles.kpiSubtext}>2 high priority</span>
          </div>
        </Card>

        <Card elevation="xs" padding="md" className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Critical Alerts</span>
            <div className={`${styles.kpiIconWrapper} ${styles.red}`}>
              <AlertOctagon size={18} />
            </div>
          </div>
          <div className={styles.kpiValue}>
            <span className={styles.redText}>1</span>
          </div>
          <div className={styles.kpiFooter}>
            <Badge variant="critical" size="sm">
              Action Required
            </Badge>
          </div>
        </Card>
      </div>

      {/* 4. Two-Column Operational Split */}
      <div className={styles.splitLayout}>
        {/* Left Column (60%): Today's Consultation Schedule */}
        <div className={styles.leftColumn}>
          <Card elevation="xs" padding="none">
            <div className={styles.sectionCardHeader}>
              <div className={styles.sectionHeaderTitle}>
                <h3>Today&apos;s Clinical Queue</h3>
                <p>Cardiology OPD • Consultations & Ward Rounds</p>
              </div>
              <Badge variant="primary" size="md">
                4 Patients
              </Badge>
            </div>

            <div className={styles.tableContainer}>
              <table className={styles.queueTable} aria-label="Today's Patient Queue">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Patient Name & MRN</th>
                    <th>Age/Sex</th>
                    <th>Time</th>
                    <th>Chief Complaint</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {DEMO_PATIENTS.map((p) => (
                    <tr key={p.id} className={p.status === 'urgent' ? styles.urgentRow : ''}>
                      <td className={styles.tokenCell}>{p.token}</td>
                      <td>
                        <div className={styles.patientCell}>
                          <span className={styles.patientName}>{p.patientName}</span>
                          <span className={styles.patientMrn}>{p.mrn}</span>
                        </div>
                      </td>
                      <td className={styles.ageCell}>{p.ageGender}</td>
                      <td className={styles.timeCell}>
                        <div className={styles.timeWrapper}>
                          <Clock size={12} />
                          <span>{p.time}</span>
                        </div>
                      </td>
                      <td className={styles.complaintCell}>{p.chiefComplaint}</td>
                      <td>{getStatusBadge(p.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Column (40%): Priority Tasks & AI Assistant */}
        <div className={styles.rightColumn}>
          {/* Priority Tasks Card */}
          <Card elevation="xs" padding="md">
            <CardHeader
              title="Priority Action Items"
              subtitle="Assigned Clinical Tasks"
              action={
                <Badge variant="urgent" size="sm">
                  {tasks.filter((t) => !t.completed).length} Pending
                </Badge>
              }
            />
            <CardContent>
              <div className={styles.taskList}>
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`
                      ${styles.taskItem}
                      ${task.completed ? styles.taskCompleted : ''}
                    `}
                    onClick={() => toggleTask(task.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <button
                      type="button"
                      className={`
                        ${styles.checkbox}
                        ${task.completed ? styles.checkboxChecked : ''}
                      `}
                      aria-label={`Mark task as ${task.completed ? 'incomplete' : 'complete'}`}
                    >
                      {task.completed && <CheckCircle2 size={16} />}
                    </button>
                    <div className={styles.taskInfo}>
                      <span className={styles.taskTitle}>{task.title}</span>
                      <div className={styles.taskMeta}>
                        <User size={12} />
                        <span>{task.patient}</span>
                        <span className={styles.metaDot}>•</span>
                        <Badge
                          variant={
                            task.priority === 'critical'
                              ? 'critical'
                              : task.priority === 'urgent'
                                ? 'urgent'
                                : 'stable'
                          }
                          size="sm"
                        >
                          {task.dueTime}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AI Clinical Assistant Card */}
          <Card elevation="xs" padding="md" className={styles.aiCard}>
            <div className={styles.aiHeader}>
              <div className={styles.aiIconCircle}>
                <Sparkles size={20} />
              </div>
              <div className={styles.aiTitleBlock}>
                <div className={styles.aiBadgeRow}>
                  <Badge variant="ai-assist" size="sm">
                    AI Clinical Assistant
                  </Badge>
                </div>
                <h4 className={styles.aiTitle}>Clinical Intelligence Drafts</h4>
              </div>
            </div>
            <p className={styles.aiDesc}>
              Review AI-drafted progress notes, automated discharge summaries, and real-time
              telemetry analytics.
            </p>
            <Button
              variant="outline"
              size="md"
              fullWidth
              iconRight={<ArrowUpRight size={16} />}
              className={styles.aiButton}
            >
              Open AI Workspace
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
