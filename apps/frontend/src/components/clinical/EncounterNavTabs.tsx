'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface EncounterNavTabsProps {
  encounterId: string;
}

export function EncounterNavTabs({ encounterId }: EncounterNavTabsProps) {
  const pathname = usePathname();

  const tabs = [
    { href: `/encounters/${encounterId}`, label: 'Overview', exact: true },
    { href: `/encounters/${encounterId}/notes`, label: 'Notes', exact: false },
    { href: `/encounters/${encounterId}/labs`, label: 'Diagnostics', exact: false },
    { href: `/encounters/${encounterId}/discharge`, label: 'Discharge', exact: false },
  ];

  return (
    <nav
      aria-label="Encounter workspace sections"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: 'var(--space-4)',
      }}
    >
      {tabs.map((t) => {
        const isActive = pathname
          ? t.exact
            ? pathname === t.href
            : pathname === t.href || pathname.startsWith(`${t.href}/`)
          : false;

        return (
          <Link
            key={t.label}
            href={t.href}
            style={{
              padding: '8px 16px',
              fontSize: '0.875rem',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: isActive ? '2px solid var(--color-primary-600)' : '2px solid transparent',
              textDecoration: 'none',
              marginBottom: '-1px',
              transition: 'color var(--duration-fast), border-color var(--duration-fast)',
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
