import React from 'react';
import styles from './Avatar.module.css';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  status?: 'online' | 'busy' | 'away' | 'offline';
}

export function Avatar({
  name = 'User',
  src,
  size = 'md',
  status,
  className = '',
  ...props
}: AvatarProps) {
  const getInitials = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  };

  const classNames = [styles.avatar, styles[size], className].filter(Boolean).join(' ');

  return (
    <div className={classNames} aria-label={name} {...props}>
      {src ? (
        <img src={src} alt={name} className={styles.image} />
      ) : (
        <span className={styles.initials}>{getInitials(name)}</span>
      )}
      {status && <span className={`${styles.statusDot} ${styles[status]}`} aria-hidden="true" />}
    </div>
  );
}
