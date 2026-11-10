// Access tokens need a secret; tests use their own instead of the one in .env
process.env.JWT_SECRET ??= 'test-secret-that-is-at-least-32-characters-long';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

// These tests stop at validation and token checks, so they run without a database.

const fields = (response) => response.body.errors.map((error) => error.field);

test('register rejects an invalid email and a short password', async () => {
  const response = await request(app).post('/auth/register').send({ email: 'not-an-email', password: 'short' });

  assert.equal(response.status, 400);
  assert.deepEqual(fields(response).sort(), ['email', 'password']);
});

test('login requires a password', async () => {
  const response = await request(app).post('/auth/login').send({ email: 'ada@example.com' });

  assert.equal(response.status, 400);
  assert.deepEqual(fields(response), ['password']);
});

test('protected routes need a valid access token', async () => {
  assert.equal((await request(app).get('/auth/me')).status, 401);
  assert.equal((await request(app).get('/auth/me').set('Authorization', 'Bearer not-a-token')).status, 401);
});

test('refresh without a token is rejected', async () => {
  const response = await request(app).post('/auth/refresh');

  assert.equal(response.status, 401);
});

test('email flows validate their input', async () => {
  const forgot = await request(app).post('/auth/forgot-password').send({ email: 'not-an-email' });
  assert.equal(forgot.status, 400);

  const reset = await request(app).post('/auth/reset-password').send({ newPassword: 'short' });
  assert.equal(reset.status, 400);
  assert.deepEqual(fields(reset).sort(), ['newPassword', 'token']);

  const verify = await request(app).post('/auth/verify-email').send({});
  assert.equal(verify.status, 400);
});
