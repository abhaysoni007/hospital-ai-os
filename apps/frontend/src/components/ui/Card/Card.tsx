import React from 'react';
import styles from './Card.module.css';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: 'xs' | 'sm' | 'md' | 'lg';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  bordered?: boolean;
}

export function Card({
  children,
  elevation = 'xs',
  padding = 'md',
  bordered = true,
  className = '',
  ...props
}: CardProps) {
  const classNames = [
    styles.card,
    styles[`elevation-${elevation}`],
    styles[`padding-${padding}`],
    bordered ? styles.bordered : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames} {...props}>
      {children}
    </div>
  );
}

export interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  children,
  className = '',
  ...props
}: CardHeaderProps) {
  return (
    <div className={`${styles.header} ${className}`} {...props}>
      {title || subtitle || icon ? (
        <div className={styles.headerContent}>
          {icon && <span className={styles.headerIcon}>{icon}</span>}
          <div>
            {title && <h3 className={styles.title}>{title}</h3>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
        </div>
      ) : null}
      {action && <div className={styles.action}>{action}</div>}
      {children}
    </div>
  );
}

export function CardContent({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${styles.content} ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${styles.footer} ${className}`} {...props}>
      {children}
    </div>
  );
}
