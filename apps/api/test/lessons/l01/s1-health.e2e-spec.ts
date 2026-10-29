/**
 * L01.S1 — Health + configureApp.
 * Контракт: course/lesson-01/README.md, розділ «Контракт».
 */
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from '../../support/create-app';
import { http } from '../../support/http';

describe('L01.S1 health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/health → 200 з {status: "ok", version, checks}', async () => {
    const res = await http(app, 'GET', '/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      version: expect.any(String),
      checks: expect.any(Object),
    });
  });

  it('GET /health (без префікса /api) → 404', async () => {
    const res = await http(app, 'GET', '/health');

    expect(res.status).toBe(404);
  });
});
