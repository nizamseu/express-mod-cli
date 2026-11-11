import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import request from 'supertest';
import app from '../src/app';
import config from '../src/admin/admin.config';
import { createZodHooks, type ValidationErrorClass } from '../src/admin/zodHooks';
import { toCsv, parseCsv } from '../src/admin/importExport';
import { changedFields } from '../src/admin/auditLog';

// The admin panel itself starts in src/index (it needs the database);
// these checks need neither.

class ValidationError extends Error {
  constructor(public propertyErrors: Record<string, { message: string }>, public baseError?: { message: string }) {
    super('Validation failed');
  }
}

const zodHooks = createZodHooks(ValidationError as unknown as ValidationErrorClass);
type Hook = ReturnType<typeof zodHooks>;
type HookArgs = Parameters<Hook>;

/** What AdminJS passes to a before-hook: the action and the model's field types */
const run = (hook: Hook, payload: Record<string, unknown>, action: string, method = 'post') =>
  hook(
    { method, payload } as unknown as HookArgs[0],
    {
      action: { name: action },
      resource: { decorate: () => ({ getPropertyByKey: (key: string) => types[key] && { type: () => types[key] } }) },
    } as unknown as HookArgs[1]
  );

const schema = z.object({
  name: z.string().trim().min(1),
  price: z.number(),
  stock: z.number().int().optional(),
  active: z.boolean().nullish(),
});
const types: Record<string, string> = { name: 'string', price: 'float', stock: 'number', active: 'boolean' };

describe('admin panel', () => {
  test('is not started when the app is imported', async () => {
    const response = await request(app).get(config.path);
    assert.equal(response.status, 404);
  });

  test('form values are converted to the field types before validation', async () => {
    const result = await run(zodHooks(schema), { name: ' Phone ', price: '12.5', stock: '3', active: 'true', _id: 'abc' }, 'new');
    assert.deepEqual(result.payload, { name: 'Phone', price: 12.5, stock: 3, active: true, _id: 'abc' });
  });

  test('empty inputs are left out when creating and cleared when editing', async () => {
    const created = await run(zodHooks(schema), { name: 'Phone', price: '1', stock: '' }, 'new');
    assert.equal('stock' in (created.payload ?? {}), false);

    const edited = await run(zodHooks(schema), { name: 'Phone', price: '1', active: '' }, 'edit');
    assert.equal(edited.payload?.active, null);
  });

  test('invalid values are reported per field', async () => {
    await assert.rejects(run(zodHooks(schema), { name: '', price: 'abc', stock: '1.5' }, 'new'), (error: ValidationError) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.propertyErrors.name.message, 'This field is required');
      assert.ok(error.propertyErrors.price);
      assert.ok(error.propertyErrors.stock);
      return true;
    });
  });

  test('CSV export and import read each other', () => {
    const rows = [{ name: 'Doe, Jane', note: 'Says "hi"\nTwice' }, { name: 'Karim', note: '' }];
    assert.deepEqual(parseCsv(toCsv(rows, ['name', 'note'])), rows);
  });

  test('the admin log names changed fields, never their values', () => {
    const before = { name: 'A', price: 1, passwordHash: 'x', updatedAt: '1' };
    const after = { name: 'A', price: 2, passwordHash: 'y', updatedAt: '2' };
    assert.deepEqual(changedFields(before, after), ['price', 'password']);
  });

  test('opening a form is not validated', async () => {
    const result = await run(zodHooks(schema), {}, 'new', 'get');
    assert.deepEqual(result.payload, {});
  });
});
