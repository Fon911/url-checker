import { useJobsStore } from '../store/jobs';
import type { UrlCheck } from '../types';
import { StatusBadge } from './StatusBadge';
import styles from './JobDetails.module.css';

const formatDateTime = (iso: string) => new Date(iso).toLocaleString('ru-RU');

const formatDuration = (ms: number | null) => {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms} мс`;
  return `${(ms / 1000).toFixed(1)} с`;
};

export function JobDetails() {
  const activeJobId = useJobsStore((state) => state.activeJobId);
  const detail = useJobsStore((state) => state.detail);
  const detailError = useJobsStore((state) => state.detailError);
  const cancelling = useJobsStore((state) => state.cancelling);
  const cancelJob = useJobsStore((state) => state.cancelJob);

  if (!activeJobId) {
    return (
      <section className={`card ${styles.placeholder}`}>
        Создайте задание или выберите его из списка
      </section>
    );
  }

  if (!detail) {
    return <section className={`card ${styles.placeholder}`}>{detailError ?? 'Загрузка…'}</section>;
  }

  const total = detail.urls.length;
  const processed = detail.urls.filter(
    (item) => item.status !== 'pending' && item.status !== 'in_progress',
  ).length;
  const cancellable = detail.status === 'pending' || detail.status === 'in_progress';

  return (
    <section className={`card ${styles.details}`}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>#{detail.id.slice(0, 8)}</h2>
          <div className={styles.meta}>
            <span>создано {formatDateTime(detail.createdAt)}</span>
            <StatusBadge status={detail.status} />
          </div>
        </div>
        {cancellable && (
          <button
            type="button"
            className="button button-danger button-small"
            disabled={cancelling}
            onClick={() => void cancelJob(detail.id)}
          >
            Отменить задание
          </button>
        )}
      </header>
      {detailError && <p className={styles.error}>{detailError}</p>}
      <div className={styles.progress}>
        <span>
          {processed} из {total} обработано
        </span>
        <div className={styles.track}>
          <div
            className={styles.fill}
            style={{ width: total > 0 ? `${(processed / total) * 100}%` : 0 }}
          />
        </div>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>URL</th>
            <th>Статус</th>
            <th>HTTP</th>
            <th>Время</th>
          </tr>
        </thead>
        <tbody>
          {detail.urls.map((item, index) => (
            <UrlRow key={index} item={item} />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function UrlRow({ item }: { item: UrlCheck }) {
  return (
    <tr>
      <td className={styles.urlCell}>
        <span className={styles.url} title={item.url}>
          {item.url}
        </span>
        {item.error && <span className={styles.urlError}>{item.error}</span>}
      </td>
      <td>
        <StatusBadge status={item.status} />
      </td>
      <td className={styles.code}>{item.httpStatus ?? '—'}</td>
      <td className={styles.code}>{formatDuration(item.duration)}</td>
    </tr>
  );
}
