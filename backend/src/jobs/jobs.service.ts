import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Job, JobSummary, UrlCheck } from './job.model';

const CONCURRENCY = 5;
const MAX_RESULT_DELAY = 10_000;
const REQUEST_TIMEOUT = 10_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const describeError = (err: unknown): string => {
  if (err instanceof Error) {
    return err.cause instanceof Error ? err.cause.message : err.message;
  }
  return 'request failed';
};

@Injectable()
export class JobsService {
  private readonly jobs = new Map<string, Job>();

  create(urls: string[]): { jobId: string } {
    const job: Job = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      status: 'pending',
      urls: urls.map((url) => ({
        url,
        status: 'pending',
        httpStatus: null,
        error: null,
        startedAt: null,
        finishedAt: null,
        duration: null,
      })),
    };
    this.jobs.set(job.id, job);
    setImmediate(() => void this.process(job));
    return { jobId: job.id };
  }

  list(): JobSummary[] {
    return [...this.jobs.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((job) => ({
        id: job.id,
        createdAt: job.createdAt,
        status: job.status,
        total: job.urls.length,
        success: job.urls.filter((item) => item.status === 'success').length,
        error: job.urls.filter((item) => item.status === 'error').length,
      }));
  }

  get(id: string): Job {
    const job = this.jobs.get(id);
    if (!job) {
      throw new NotFoundException(`Job ${id} not found`);
    }
    return job;
  }

  cancel(id: string): Job {
    const job = this.get(id);
    if (job.status === 'pending' || job.status === 'in_progress') {
      job.status = 'cancelled';
      for (const item of job.urls) {
        if (item.status === 'pending') {
          item.status = 'cancelled';
        }
      }
    }
    return job;
  }

  private async process(job: Job): Promise<void> {
    if (job.status !== 'pending') {
      return;
    }
    job.status = 'in_progress';
    let cursor = 0;
    const worker = async () => {
      while (job.status === 'in_progress' && cursor < job.urls.length) {
        await this.check(job.urls[cursor++]);
      }
    };
    try {
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, job.urls.length) }, worker),
      );
    } catch {
      job.status = 'failed';
      return;
    }
    if (job.status === 'in_progress') {
      job.status = job.urls.some((item) => item.status === 'success')
        ? 'completed'
        : 'failed';
    }
  }

  private async check(item: UrlCheck): Promise<void> {
    item.status = 'in_progress';
    item.startedAt = new Date().toISOString();
    const started = Date.now();
    let httpStatus: number | null = null;
    let error: string | null = null;
    try {
      const response = await fetch(item.url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });
      httpStatus = response.status;
      if (response.status >= 400) {
        error = `HTTP ${response.status}`;
      }
    } catch (err) {
      error = describeError(err);
    }
    await sleep(Math.random() * MAX_RESULT_DELAY);
    item.httpStatus = httpStatus;
    item.error = error;
    item.status = error === null ? 'success' : 'error';
    item.finishedAt = new Date().toISOString();
    item.duration = Date.now() - started;
  }
}
