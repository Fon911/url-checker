import type { JobDetail, JobSummary } from '../types';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function readError(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (Array.isArray(message)) return message.join('; ');
    if (typeof message === 'string') return message;
  }
  return `Ошибка запроса (${response.status})`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, init);
  if (!response.ok) {
    throw new ApiError(await readError(response), response.status);
  }
  return response.json() as Promise<T>;
}

export const createJob = (urls: string[]) =>
  request<{ jobId: string }>('/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls }),
  });

export const fetchJobs = () => request<JobSummary[]>('/jobs');

export const fetchJob = (id: string) => request<JobDetail>(`/jobs/${id}`);

export const cancelJob = (id: string) => request<JobDetail>(`/jobs/${id}`, { method: 'DELETE' });
