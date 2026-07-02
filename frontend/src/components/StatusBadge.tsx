import type { JobStatus, UrlStatus } from '../types';
import styles from './StatusBadge.module.css';

type Status = JobStatus | UrlStatus;

const LABELS: Record<Status, string> = {
  pending: 'в очереди',
  in_progress: 'выполняется',
  completed: 'завершено',
  success: 'успех',
  error: 'ошибка',
  failed: 'ошибка',
  cancelled: 'отменено',
};

const TONES: Record<Status, string> = {
  pending: styles.gray,
  in_progress: styles.amber,
  completed: styles.green,
  success: styles.green,
  error: styles.red,
  failed: styles.red,
  cancelled: styles.gray,
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`${styles.badge} ${TONES[status]}`}>
      <span className={styles.dot} />
      {LABELS[status]}
    </span>
  );
}
