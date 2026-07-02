import { useJobsStore } from '../store/jobs';
import { StatusBadge } from './StatusBadge';
import styles from './JobList.module.css';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export function JobList() {
  const jobs = useJobsStore((state) => state.jobs);
  const jobsLoaded = useJobsStore((state) => state.jobsLoaded);
  const jobsError = useJobsStore((state) => state.jobsError);
  const activeJobId = useJobsStore((state) => state.activeJobId);
  const selectJob = useJobsStore((state) => state.selectJob);

  let message: string | null = null;
  if (jobsError) {
    message = jobsError;
  } else if (!jobsLoaded) {
    message = 'Загрузка…';
  } else if (jobs.length === 0) {
    message = 'Заданий пока нет';
  }

  return (
    <section className={`card ${styles.list}`}>
      <h2 className={styles.title}>Задания</h2>
      {message && <p className={styles.message}>{message}</p>}
      {jobs.map((job) => (
        <button
          key={job.id}
          type="button"
          className={job.id === activeJobId ? `${styles.row} ${styles.active}` : styles.row}
          onClick={() => selectJob(job.id)}
        >
          <span className={styles.rowTop}>
            <span className={styles.id}>#{job.id.slice(0, 8)}</span>
            <StatusBadge status={job.status} />
          </span>
          <span className={styles.rowBottom}>
            <span>{formatDate(job.createdAt)}</span>
            <span className={styles.stats}>
              <span>✓ {job.success}</span>
              <span>✕ {job.error}</span>
              <span>{job.total} URL</span>
            </span>
          </span>
        </button>
      ))}
    </section>
  );
}
