import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/setup';
import { JobSummary, UrlCheck } from './../src/jobs/job.model';

const ok = (status = 200) => ({ status }) as Response;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Jobs API (e2e)', () => {
  let app: INestApplication<App>;
  let fetchSpy: jest.SpyInstance;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(ok());
    jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it('отклоняет невалидное тело запроса', async () => {
    await request(app.getHttpServer()).post('/api/jobs').send({}).expect(400);
    await request(app.getHttpServer())
      .post('/api/jobs')
      .send({ urls: [] })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/jobs')
      .send({ urls: 'not-a-list' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/jobs')
      .send({ urls: ['ftp://files.dev'] })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/jobs')
      .send({ urls: Array<string>(1001).fill('https://a.dev') })
      .expect(400);
  });

  it('возвращает 404 для неизвестного задания', async () => {
    await request(app.getHttpServer()).get('/api/jobs/missing').expect(404);
    await request(app.getHttpServer()).delete('/api/jobs/missing').expect(404);
  });

  it('проходит полный цикл: создание, список, детали, отмена', async () => {
    fetchSpy.mockImplementation(
      () =>
        new Promise<Response>((resolve) =>
          setTimeout(() => resolve(ok()), 150),
        ),
    );

    const created = await request(app.getHttpServer())
      .post('/api/jobs')
      .send({ urls: ['https://example.com', 'https://google.com'] })
      .expect(201);
    const { jobId } = created.body as { jobId: string };
    expect(jobId).toBeTruthy();

    const list = await request(app.getHttpServer())
      .get('/api/jobs')
      .expect(200);
    const jobs = list.body as JobSummary[];
    expect(jobs.some((job) => job.id === jobId && job.total === 2)).toBe(true);

    const detail = await request(app.getHttpServer())
      .get(`/api/jobs/${jobId}`)
      .expect(200);
    const { urls } = detail.body as { urls: UrlCheck[] };
    expect(urls.map((item) => item.url)).toEqual([
      'https://example.com',
      'https://google.com',
    ]);

    const cancelled = await request(app.getHttpServer())
      .delete(`/api/jobs/${jobId}`)
      .expect(200);
    expect((cancelled.body as { status: string }).status).toBe('cancelled');

    let settled: UrlCheck[] = [];
    for (let attempt = 0; attempt < 20; attempt++) {
      const current = await request(app.getHttpServer())
        .get(`/api/jobs/${jobId}`)
        .expect(200);
      settled = (current.body as { urls: UrlCheck[] }).urls;
      if (
        settled.every(
          (item) => item.status !== 'pending' && item.status !== 'in_progress',
        )
      ) {
        break;
      }
      await wait(50);
    }
    expect(settled.every((item) => item.status === 'success')).toBe(true);
  });
});
