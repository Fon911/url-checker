import { NotFoundException } from '@nestjs/common';
import { JobsService } from './jobs.service';

const ok = (status = 200) => ({ status }) as Response;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (condition: () => boolean): Promise<void> => {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > 2000) {
      throw new Error('condition timeout');
    }
    await wait(5);
  }
};

describe('JobsService', () => {
  let service: JobsService;
  let fetchSpy: jest.SpyInstance;

  const deferResponses = () => {
    const resolvers: Array<() => void> = [];
    fetchSpy.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolvers.push(() => resolve(ok()));
        }),
    );
    return resolvers;
  };

  beforeEach(() => {
    service = new JobsService();
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(ok());
    jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('создаёт задание со статусом pending и обрабатывает его в фоне', async () => {
    const { jobId } = service.create(['https://a.dev']);
    expect(service.get(jobId).status).toBe('pending');
    await waitFor(() => service.get(jobId).status === 'completed');
  });

  it('делает HEAD-запрос и сохраняет результат проверки', async () => {
    const { jobId } = service.create(['https://a.dev']);
    await waitFor(() => service.get(jobId).status === 'completed');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://a.dev',
      expect.objectContaining({ method: 'HEAD' }),
    );
    const [item] = service.get(jobId).urls;
    expect(item.status).toBe('success');
    expect(item.httpStatus).toBe(200);
    expect(item.error).toBeNull();
    expect(item.startedAt).not.toBeNull();
    expect(item.finishedAt).not.toBeNull();
    expect(item.duration).toBeGreaterThanOrEqual(0);
  });

  it('считает статистику успешных и упавших URL', async () => {
    fetchSpy.mockImplementation((input: string) =>
      Promise.resolve(ok(input.includes('bad') ? 404 : 200)),
    );
    const { jobId } = service.create(['https://good.dev', 'https://bad.dev']);
    await waitFor(() => service.get(jobId).status === 'completed');
    const summary = service.list().find((job) => job.id === jobId);
    expect(summary).toMatchObject({ total: 2, success: 1, error: 1 });
    const failed = service.get(jobId).urls[1];
    expect(failed.status).toBe('error');
    expect(failed.httpStatus).toBe(404);
    expect(failed.error).toBe('HTTP 404');
  });

  it('помечает задание failed, если ни один URL не проверился', async () => {
    fetchSpy.mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    const { jobId } = service.create(['https://a.dev', 'https://b.dev']);
    await waitFor(() => service.get(jobId).status === 'failed');
    const [item] = service.get(jobId).urls;
    expect(item.status).toBe('error');
    expect(item.error).toBe('getaddrinfo ENOTFOUND');
    expect(item.httpStatus).toBeNull();
  });

  it('не запускает больше 5 запросов одновременно', async () => {
    const resolvers = deferResponses();
    const { jobId } = service.create(
      Array.from({ length: 12 }, (_, i) => `https://site-${i}.dev`),
    );
    await waitFor(() => resolvers.length === 5);
    await wait(20);
    expect(fetchSpy).toHaveBeenCalledTimes(5);

    resolvers[0]();
    await waitFor(() => resolvers.length === 6);
    expect(fetchSpy).toHaveBeenCalledTimes(6);

    await waitFor(() => {
      resolvers.splice(0).forEach((resolve) => resolve());
      return service.get(jobId).status === 'completed';
    });
    expect(fetchSpy).toHaveBeenCalledTimes(12);
  });

  it('обрабатывает несколько заданий одновременно', async () => {
    const resolvers = deferResponses();
    const first = service.create(
      Array.from({ length: 5 }, (_, i) => `https://a-${i}.dev`),
    );
    const second = service.create(
      Array.from({ length: 5 }, (_, i) => `https://b-${i}.dev`),
    );
    await waitFor(() => resolvers.length === 10);
    expect(service.get(first.jobId).status).toBe('in_progress');
    expect(service.get(second.jobId).status).toBe('in_progress');

    resolvers.forEach((resolve) => resolve());
    await waitFor(
      () =>
        service.get(first.jobId).status === 'completed' &&
        service.get(second.jobId).status === 'completed',
    );
  });

  it('отмена помечает не начатые URL и не запускает новые запросы', async () => {
    const resolvers = deferResponses();
    const { jobId } = service.create(
      Array.from({ length: 12 }, (_, i) => `https://site-${i}.dev`),
    );
    await waitFor(() => resolvers.length === 5);

    service.cancel(jobId);
    expect(service.get(jobId).status).toBe('cancelled');
    expect(
      service.get(jobId).urls.filter((item) => item.status === 'cancelled'),
    ).toHaveLength(7);

    resolvers.forEach((resolve) => resolve());
    await waitFor(
      () =>
        service.get(jobId).urls.filter((item) => item.status === 'success')
          .length === 5,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(5);
    expect(service.get(jobId).status).toBe('cancelled');
  });

  it('отменяет задание до старта обработки', async () => {
    deferResponses();
    const { jobId } = service.create(['https://a.dev']);
    service.cancel(jobId);
    await wait(20);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(service.get(jobId).status).toBe('cancelled');
    expect(service.get(jobId).urls[0].status).toBe('cancelled');
  });

  it('не меняет статус уже завершённого задания при отмене', async () => {
    const { jobId } = service.create(['https://a.dev']);
    await waitFor(() => service.get(jobId).status === 'completed');
    service.cancel(jobId);
    expect(service.get(jobId).status).toBe('completed');
  });

  it('кидает NotFound для неизвестного задания', () => {
    expect(() => service.get('missing')).toThrow(NotFoundException);
    expect(() => service.cancel('missing')).toThrow(NotFoundException);
  });
});
