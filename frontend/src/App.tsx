import { useEffect } from 'react';
import { CreateJobForm } from './components/CreateJobForm';
import { JobDetails } from './components/JobDetails';
import { JobList } from './components/JobList';
import { useJobsStore } from './store/jobs';
import styles from './App.module.css';

const LIST_REFRESH_INTERVAL = 5000;

export default function App() {
  const loadJobs = useJobsStore((state) => state.loadJobs);

  useEffect(() => {
    void loadJobs();
    const timer = window.setInterval(() => void loadJobs(), LIST_REFRESH_INTERVAL);
    return () => window.clearInterval(timer);
  }, [loadJobs]);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <span className={styles.mark} />
          <span className={styles.name}>URL Checker</span>
        </div>
      </header>
      <main className={styles.main}>
        <div className={styles.side}>
          <CreateJobForm />
          <JobList />
        </div>
        <JobDetails />
      </main>
    </>
  );
}
