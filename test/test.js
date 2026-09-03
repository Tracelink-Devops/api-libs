/**
 * Tests for the Tracelink API client.
 *
 * These run against a stubbed fetch - no credentials or network access needed.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const { TracelinkClient, TracelinkError, buildOrderParams } = require('../src/tracelink-client.js');

/**
 * Install a fetch stub that answers each call from the queued responses and
 * records the requests that were made.
 * @param {Array<{status?: number, body?: string, headers?: Object}>} responses
 * @returns {{requests: Array<{url: string, headers: Object, body: Object}>}}
 */
function stubFetch(responses) {
  const requests = [];
  let index = 0;

  globalThis.fetch = async (url, options) => {
    requests.push({ url, headers: options.headers, body: JSON.parse(options.body) });

    const response = responses[index++];
    if (!response) {
      throw new Error(`Unexpected request to ${url}`);
    }

    const status = response.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Map(Object.entries(response.headers ?? {})),
      text: async () => response.body ?? '',
    };
  };

  return { requests };
}

function ok(payload) {
  return { status: 200, body: JSON.stringify({ status: 'ok', code: 200, ...payload }) };
}

test('constructor requires an access_token', () => {
  assert.throws(() => new TracelinkClient({}), /access_token is required/);
});

test('suborder.create sends the parent id under parent_id', async () => {
  const { requests } = stubFetch([{ status: 201, body: JSON.stringify({ status: 'ok', code: 201, order_sub_id: 7 }) }]);
  const client = new TracelinkClient({ access_token: 'token' });

  const result = await client.suborder.create(1040, { name: 'Subtask 1' });

  assert.equal(result.order_sub_id, 7);
  assert.equal(requests[0].url, 'https://tracelink.app/rest/tracelink/suborder/create');
  assert.deepEqual(requests[0].body.object, { parent_id: 1040, name: 'Subtask 1' });
});

test('suborder.list builds order params', async () => {
  const { requests } = stubFetch([ok({ suborder: [] })]);
  const client = new TracelinkClient({ access_token: 'token' });

  await client.suborder.list({ limit: 5, sort: 'name', reverse: true });

  assert.deepEqual(requests[0].body, { order: { sort: 'name', reverse: 1, limit: 5 } });
});

test('order.update sends the id in the URL path', async () => {
  const { requests } = stubFetch([ok({})]);
  const client = new TracelinkClient({ access_token: 'token' });

  await client.order.update(1040, { name: 'Updated name' });

  assert.equal(requests[0].url, 'https://tracelink.app/rest/tracelink/order/update/1040');
  assert.deepEqual(requests[0].body.object, { name: 'Updated name' });
});

test('suborder.update sends the id in the URL path', async () => {
  const { requests } = stubFetch([ok({})]);
  const client = new TracelinkClient({ access_token: 'token' });

  await client.suborder.update(7, { name: 'New name' });

  assert.equal(requests[0].url, 'https://tracelink.app/rest/tracelink/suborder/update/7');
  assert.deepEqual(requests[0].body.object, { name: 'New name' });
});

test('an empty 500 body raises a TracelinkError flagged as empty_body', async () => {
  stubFetch([{ status: 500, body: '' }]);
  const client = new TracelinkClient({ access_token: 'token' });

  await assert.rejects(
    () => client.object.list('trace'),
    (error) => {
      assert.ok(error instanceof TracelinkError);
      assert.equal(error.code, 500);
      assert.equal(error.http_status, 500);
      assert.equal(error.empty_body, true);
      assert.match(error.message, /\/object\/list\/module\/trace \(empty body\)/);
      return true;
    }
  );
});

test('a non-JSON body raises a TracelinkError, not a SyntaxError', async () => {
  stubFetch([{ status: 502, body: '<html>Bad Gateway</html>' }]);
  const client = new TracelinkClient({ access_token: 'token' });

  await assert.rejects(
    () => client.util.listDocuments('procedure'),
    (error) => {
      assert.ok(error instanceof TracelinkError);
      assert.equal(error.code, 502);
      assert.equal(error.empty_body, false);
      assert.equal(error.raw_body, '<html>Bad Gateway</html>');
      return true;
    }
  );
});

test('an error envelope keeps its API code and message', async () => {
  stubFetch([{ status: 400, body: JSON.stringify({ status: 'error', code: 400, message: 'No parent_id specified' }) }]);
  const client = new TracelinkClient({ access_token: 'token' });

  await assert.rejects(
    () => client.order.get(99999),
    (error) => {
      assert.equal(error.message, 'No parent_id specified');
      assert.equal(error.code, 400);
      assert.equal(error.response.status, 'error');
      return true;
    }
  );
});

test('a cached response is annotated from the X-ResultFromCache header', async () => {
  stubFetch([{ ...ok({ order_id: 1 }), headers: { 'X-ResultFromCache': 'key-123' } }]);
  const client = new TracelinkClient({ access_token: 'token' });

  const result = await client.order.create({ name: 'Order' }, { idempotency_key: 'key-123' });

  assert.equal(result._cached, true);
  assert.equal(result._idempotency_key, 'key-123');
});

test('object.get appends $expand for sub-tables', async () => {
  const { requests } = stubFetch([ok({ object: {} }), ok({ object: {} })]);
  const client = new TracelinkClient({ access_token: 'token' });

  await client.object.get('purchase', 156, { expand: 'line' });
  await client.object.get('purchase', 156, { expand: ['line', 'journal'] });

  assert.ok(requests[0].url.endsWith('/object/list/module/purchase/156?$expand=line'));
  assert.ok(requests[1].url.endsWith('/object/list/module/purchase/156?$expand=line%2Cjournal'));
});

test('object.update sends the id in the URL path when given as a separate argument', async () => {
  const { requests } = stubFetch([ok({})]);
  const client = new TracelinkClient({ access_token: 'token' });

  await client.object.update('purchase', 156, { name: 'Updated name' });

  assert.equal(requests[0].url, 'https://tracelink.app/rest/object/update/purchase/156');
  assert.deepEqual(requests[0].body.object, { name: 'Updated name' });
});

test('object.update falls back to the legacy id-in-payload form', async () => {
  const { requests } = stubFetch([ok({})]);
  const client = new TracelinkClient({ access_token: 'token' });

  await client.object.update('purchase', { purchase_id: 156, name: 'Updated name' });

  assert.equal(requests[0].url, 'https://tracelink.app/rest/object/update/purchase');
  assert.deepEqual(requests[0].body.object, { purchase_id: 156, name: 'Updated name' });
});

test('object.update passes options through in both forms', async () => {
  const { requests } = stubFetch([ok({}), ok({})]);
  const client = new TracelinkClient({ access_token: 'token' });

  await client.object.update('purchase', 156, { name: 'A' }, { idempotency_key: 'key-1' });
  await client.object.update('purchase', { purchase_id: 156, name: 'B' }, { idempotency_key: 'key-2' });

  assert.equal(requests[0].headers['Idempotency-Key'], 'key-1');
  assert.equal(requests[1].headers['Idempotency-Key'], 'key-2');
});

test('buildOrderParams returns an empty object when there is nothing to send', () => {
  assert.deepEqual(buildOrderParams(), {});
  assert.deepEqual(buildOrderParams({ filter: { locked: '=0' }, filter_or: true }), {
    order: { filter: { locked: '=0' }, filter_or: true },
  });
});
