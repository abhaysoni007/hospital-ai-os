import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../Button/Button';
import styles from './ErrorState.module.css';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  correlationId?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected system error occurred while processing your request.',
  correlationId,
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div className={`${styles.container} ${className}`} role="alert">
      <div className={styles.iconWrapper}>
        <AlertCircle size={32} aria-hidden="true" />
      </div>
      <h4 className={styles.title}>{title}</h4>
      <p className={styles.message}>{message}</p>
      {correlationId && (
        <p className={styles.correlationId}>
          Incident ID: <code>{correlationId}</code>
        </p>
      )}
      {onRetry && (
        <div className={styles.action}>
          <Button
            variant="secondary"
            size="md"
            iconLeft={<RefreshCw size={16} />}
            onClick={onRetry}
          >
            Retry Request
          </Button>
        </div>
      )}
    </div>
  );
}
