'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  LayoutDashboard,
  Users,
  Calendar,
  Stethoscope,
  FlaskConical,
  CheckSquare,
  Brain,
  ShieldAlert,
  UserCheck,
  FileText,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/rbac';
import styles from './CommandMenu.module.css';

interface CommandItem {
  id: string;
  label: string;
  href: string;
  category: 'Operations' | 'Clinical' | 'Workspace' | 'Administration';
  icon: React.ReactNode;
  permission?: import('../../types/auth').Permission;
}

const COMMANDS: CommandItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', category: 'Operations', icon: <LayoutDashboard size={16} /> },
  { id: 'patients', label: 'Patients', href: '/patients', category: 'Operations', icon: <Users size={16} />, permission: 'patient:read' },
  { id: 'patient-new', label: 'Register New Patient', href: '/patients/new', category: 'Operations', icon: <Users size={16} />, permission: 'patient:create' },
  { id: 'appointments', label: 'Appointments Queue', href: '/appointments', category: 'Operations', icon: <Calendar size={16} />, permission: 'appointment:read' },
  { id: 'appointment-new', label: 'Book Appointment', href: '/appointments/new', category: 'Operations', icon: <Calendar size={16} />, permission: 'appointment:create' },
  { id: 'encounters', label: 'Active Encounters', href: '/encounters', category: 'Operations', icon: <Stethoscope size={16} />, permission: 'encounter:read' },
  { id: 'intelligence', label: 'Operational Intelligence', href: '/intelligence', category: 'Operations', icon: <Brain size={16} />, permission: 'intelligence:read' },
  { id: 'diagnostics', label: 'Diagnostics & Lab Queue', href: '/diagnostics', category: 'Clinical', icon: <FlaskConical size={16} />, permission: 'diagnostic_order:read' },
  { id: 'tasks', label: 'My Task Inbox', href: '/tasks', category: 'Workspace', icon: <CheckSquare size={16} />, permission: 'task:read' },
  { id: 'admin-staff', label: 'Staff Management', href: '/admin/staff', category: 'Administration', icon: <UserCheck size={16} />, permission: 'staff:manage' },
  { id: 'admin-audit', label: 'Audit Log Viewer', href: '/admin/audit', category: 'Administration', icon: <FileText size={16} />, permission: 'audit_event:read' },
  { id: 'admin-security', label: 'Security & Break-Glass Review', href: '/admin/security', category: 'Administration', icon: <ShieldAlert size={16} />, permission: 'break_glass:review' },
];

export function CommandMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+J or Cmd/Ctrl+Shift+K opens quick navigation command palette
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') ||
          ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    const handleCustomOpen = () => setIsOpen(true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-command-palette', handleCustomOpen);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-command-palette', handleCustomOpen);
    };
  }, []);

  const availableCommands = COMMANDS.filter((cmd) => {
    if (cmd.permission && !hasPermission(user?.role, cmd.permission)) {
      return false;
    }
    if (!query.trim()) return true;
    return (
      cmd.label.toLowerCase().includes(query.toLowerCase()) ||
      cmd.category.toLowerCase().includes(query.toLowerCase())
    );
  });

  const handleSelect = (href: string) => {
    setIsOpen(false);
    setQuery('');
    router.push(href);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={() => setIsOpen(false)} role="dialog" aria-modal="true">
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.searchHeader}>
          <Search size={18} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search commands, screens, actions… (ESC to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button type="button" className={styles.closeBtn} onClick={() => setIsOpen(false)} aria-label="Close command palette">
            <X size={16} />
          </button>
        </div>

        <div className={styles.commandList}>
          {availableCommands.length === 0 ? (
            <p className={styles.noResults}>No matching commands or routes found.</p>
          ) : (
            availableCommands.map((cmd) => (
              <button
                key={cmd.id}
                type="button"
                className={styles.commandItem}
                onClick={() => handleSelect(cmd.href)}
              >
                <span className={styles.commandIcon} aria-hidden="true">{cmd.icon}</span>
                <span className={styles.commandLabel}>{cmd.label}</span>
                <span className={styles.commandCategory}>{cmd.category}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
