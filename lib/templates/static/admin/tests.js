const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { z } = require('zod');
const request = require('supertest');
const app = require('../src/app');
const config = require('../src/admin/admin.config');
const { createZodHooks } = require('../src/admin/zodHooks');
const { toCsv, parseCsv } = require('../src/admin/importExport');
const { changedFields } = require('../src/admin/auditLog');

// The admin panel itself starts in src/index (it needs the database);
// these checks need neither.

class ValidationError extends Error {
  constructor(propertyErrors, baseError) {
    super('Validation failed');
    this.propertyErrors = propertyErrors;
    this.baseError = baseError;
  }
}

const zodHooks = createZodHooks(ValidationError);

/** What AdminJS passes to a before-hook: the action and the model's field types */
const contextFor = (action, types) => ({
  action: { name: action },
  resource: { decorate: () => ({ getPropertyByKey: (key) => types[key] && { type: () => types[key] } }) },
});

const schema = z.object({
  name: z.string().trim().min(1),
  price: z.number(),
  stock: z.number().int().optional(),
  active: z.boolean().nullish(),
});
const types = { name: 'string', price: 'float', stock: 'number', active: 'boolean' };

describe('admin panel', () => {
  test('is not started when the app is imported', async () => {
    const response = await request(app).get(config.path);
    assert.equal(response.status, 404);
  });

  test('form values are converted to the field types before validation', async () => {
    const hook = zodHooks(schema);
    const result = await hook(
      { method: 'post', payload: { name: ' Phone ', price: '12.5', stock: '3', active: 'true', _id: 'abc' } },
      contextFor('new', types)
    );

    assert.deepEqual(result.payload, { name: 'Phone', price: 12.5, stock: 3, active: true, _id: 'abc' });
  });

  test('empty inputs are left out when creating and cleared when editing', async () => {
    const hook = zodHooks(schema);

    const created = await hook({ method: 'post', payload: { name: 'Phone', price: '1', stock: '' } }, contextFor('new', types));
    assert.equal('stock' in created.payload, false);

    const edited = await hook({ method: 'post', payload: { name: 'Phone', price: '1', active: '' } }, contextFor('edit', types));
    assert.equal(edited.payload.active, null);
  });

  test('invalid values are reported per field', async () => {
    const hook = zodHooks(schema);

    await assert.rejects(
      hook({ method: 'post', payload: { name: '', price: 'abc', stock: '1.5' } }, contextFor('new', types)),
      (error) => {
        assert.ok(error instanceof ValidationError);
        assert.equal(error.propertyErrors.name.message, 'This field is required');
        assert.ok(error.propertyErrors.price);
        assert.ok(error.propertyErrors.stock);
        return true;
      }
    );
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
    const hook = zodHooks(schema);
    const get = { method: 'get', payload: {} };
    assert.equal(await hook(get, contextFor('new', types)), get);
  });
});
