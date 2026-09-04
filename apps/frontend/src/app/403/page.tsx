'use client';

import React from 'react';
import { PermissionDeniedState } from '../../components/ui/States';

export default function ForbiddenPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)' }}>
      <PermissionDeniedState resource="this clinical resource or administrative workspace" />
    </div>
  );
}
