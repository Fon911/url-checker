import { create } from 'zustand';
import { ApiError, cancelJob, createJob, fetchJob, fetchJobs } from '../api/jobs';
import type { JobDetail, JobSummary } from '../types';

const POLL_INTERVAL = 2000;

const JOB_DONE = new Set(['completed', 'cancelled', 'failed']);
const URL_DONE = new Set(['success', 'error', 'cancelled']);

const isSettled = (detail: JobDetail) =>
  JOB_DONE.has(detail.status) && detail.urls.every((item) => URL_DONE.has(item.status));

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback;

interface JobsState {
  jobs: JobSummary[];
  jobsLoaded: boolean;
  jobsError: string | null;
  activeJobId: string | null;
  detail: JobDetail | null;
  detailError: string | null;
  creating: boolean;
  createError: string | null;
  cancelling: boolean;
  loadJobs: () => Promise<void>;
  createJob: (urls: string[]) => Promise<boolean>;
  selectJob: (id: string) => void;
  cancelJob: (id: string) => Promise<void>;
}

let pollTimer: number | undefined;
let pollGeneration = 0;

export const useJobsStore = create<JobsState>()((set, get) => {
  const poll = async (id: string, generation: number) => {
    let detail: JobDetail;
    try {
      detail = await fetchJob(id);
    } catch (err) {
      if (generation !== pollGeneration) return;
      if (err instanceof ApiError && err.status === 404) {
        set({ detail: null, detailError: 'Задание не найдено' });
        return;
      }
      pollTimer = window.setTimeout(() => void poll(id, generation), POLL_INTERVAL);
      return;
    }
    if (generation !== pollGeneration) return;
    set({ detail, detailError: null });
    if (isSettled(detail)) {
      void get().loadJobs();
    } else {
      pollTimer = window.setTimeout(() => void poll(id, generation), POLL_INTERVAL);
    }
  };

  const watch = (id: string) => {
    window.clearTimeout(pollTimer);
    pollGeneration += 1;
    set({ activeJobId: id, detail: null, detailError: null });
    void poll(id, pollGeneration);
  };

  return {
    jobs: [],
    jobsLoaded: false,
    jobsError: null,
    activeJobId: null,
    detail: null,
    detailError: null,
    creating: false,
    createError: null,
    cancelling: false,

    loadJobs: async () => {
      try {
        set({ jobs: await fetchJobs(), jobsLoaded: true, jobsError: null });
      } catch (err) {
        set({ jobsLoaded: true, jobsError: errorText(err, 'Не удалось загрузить список') });
      }
    },

    createJob: async (urls) => {
      set({ creating: true, createError: null });
      try {
        const { jobId } = await createJob(urls);
        watch(jobId);
        void get().loadJobs();
        return true;
      } catch (err) {
        set({ createError: errorText(err, 'Не удалось создать задание') });
        return false;
      } finally {
        set({ creating: false });
      }
    },

    selectJob: (id) => {
      if (get().activeJobId !== id) {
        watch(id);
      }
    },

    cancelJob: async (id) => {
      set({ cancelling: true });
      try {
        const detail = await cancelJob(id);
        if (get().activeJobId === id) {
          window.clearTimeout(pollTimer);
          pollGeneration += 1;
          set({ detail, detailError: null });
          if (!isSettled(detail)) {
            const generation = pollGeneration;
            pollTimer = window.setTimeout(() => void poll(id, generation), POLL_INTERVAL);
          }
        }
        void get().loadJobs();
      } catch (err) {
        if (get().activeJobId === id) {
          set({ detailError: errorText(err, 'Не удалось отменить задание') });
        }
      } finally {
        set({ cancelling: false });
      }
    },
  };
});
