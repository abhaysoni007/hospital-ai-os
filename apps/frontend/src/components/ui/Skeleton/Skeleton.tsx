import React from 'react';
import styles from './Skeleton.module.css';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  borderRadius,
  className = '',
  style,
  ...props
}: SkeletonProps) {
  const customStyles: React.CSSProperties = {
    ...style,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(borderRadius !== undefined ? { borderRadius } : {}),
  };

  const classNames = [styles.skeleton, styles[variant], className].filter(Boolean).join(' ');

  return <div className={classNames} style={customStyles} aria-hidden="true" {...props} />;
}
