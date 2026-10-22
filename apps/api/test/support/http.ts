/**
 * Машинерія курсу: HTTP-запити до застосунку через supertest (без реального порту).
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const methods = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  PATCH: 'patch',
  DELETE: 'delete',
} as const;

export function http(app: INestApplication, method: HttpMethod, path: string): request.Test {
  const agent = request(app.getHttpServer() as App);
  return agent[methods[method]](path);
}
