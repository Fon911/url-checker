export type JobStatus =
  'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed';

export type UrlStatus =
  'pending' | 'in_progress' | 'success' | 'error' | 'cancelled';

export interface UrlCheck {
  url: string;
  status: UrlStatus;
  httpStatus: number | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  duration: number | null;
}

export interface Job {
  id: string;
  createdAt: string;
  status: JobStatus;
  urls: UrlCheck[];
}

export interface JobSummary {
  id: string;
  createdAt: string;
  status: JobStatus;
  total: number;
  success: number;
  error: number;
}
