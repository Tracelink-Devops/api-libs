/**
 * Live integration tests against a real Tracelink tenant.
 *
 * These are opt-in and skipped unless credentials are present in the environment:
 *
 *   TRACELINK_TOKEN=<token> TRACELINK_BASE_URL=https://<tenant>.tracelink.app/rest \
 *     node --test test/live.test.js
 *
 * They create and delete orders, suborders and module objects, so the token
 * needs delete privileges and should point at a sandbox tenant.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const { TracelinkClient, TracelinkError } = require('../src/tracelink-client.js');

const access_token = process.env.TRACELINK_TOKEN;
const base_url = process.env.TRACELINK_BASE_URL;
const skip = access_token ? false : 'TRACELINK_TOKEN not set';

const client = access_token ? new TracelinkClient({ access_token, base_url }) : null;
const label = `api-libs test ${Date.now()}`;

test('suborder.create accepts the parent id and round-trips', { skip }, async (t) => {
  const order = await client.order.create({ name: `${label} order` });
  assert.ok(order.order_id, 'expected an order_id back');
  t.after(() => client.order.delete(order.order_id));

  const suborder = await client.suborder.create(order.order_id, { name: `${label} sub` });
  assert.ok(suborder.order_sub_id, 'expected an order_sub_id back');
  t.after(() => client.suborder.delete(suborder.order_sub_id));

  const fetched = await client.suborder.get(suborder.order_sub_id);
  assert.equal(fetched.suborder.name, `${label} sub`);
  // The parent is sent as `parent_id` but comes back as `order_id`.
  assert.equal(String(fetched.suborder.order_id), String(order.order_id));
});

test('delete removes orders, suborders and module objects', { skip }, async () => {
  const order = await client.order.create({ name: `${label} deletable` });
  const suborder = await client.suborder.create(order.order_id, { name: `${label} deletable sub` });
  const purchase = await client.object.create('purchase', { name: `${label} deletable po` });
  const purchase_id = purchase.object.purchase_id;

  const timereg = await client.order.addModule('timereg', {
    order_id: order.order_id,
    order_sub_id: 0,
    hours: 1,
    minutes: 0,
  });

  await client.order.deleteModule('timereg', 'timereg_id', timereg.object.timereg_id);
  await client.object.delete('purchase', 'purchase_id', purchase_id);
  await client.suborder.delete(suborder.order_sub_id);
  await client.order.delete(order.order_id);

  const remaining = await client.order.list({ filter: { name: `${label} deletable` } });
  assert.equal(remaining.count, 0, 'deleted order should no longer be listed');

  const purchases = await client.object.list('purchase', { filter: { name: `${label} deletable po` } });
  assert.equal(purchases.count, 0, 'deleted purchase should no longer be listed');
});

test('a module without a generic object endpoint raises empty_body', { skip }, async () => {
  await assert.rejects(
    () => client.object.list('trace'),
    (error) => {
      assert.ok(error instanceof TracelinkError, `expected TracelinkError, got ${error.name}`);
      assert.equal(error.empty_body, true);
      assert.equal(error.http_status, 500);
      return true;
    }
  );
});

test('a bare LIKE filter is a prefix match, not a contains match', { skip }, async (t) => {
  const order = await client.order.create({ name: `${label} findme suffix` });
  t.after(() => client.order.delete(order.order_id));

  const prefix = await client.order.list({ filter: { name: `${label} findme` } });
  const contains = await client.order.list({ filter: { name: '%findme suffix' } });
  const middle = await client.order.list({ filter: { name: 'findme suffix' } });

  assert.ok(prefix.count >= 1, 'a leading substring should match');
  assert.ok(contains.count >= 1, 'a leading % should match anywhere');
  assert.equal(middle.count, 0, 'a mid-value substring should not match without a leading %');
});

test('company.get nests master data and returns ui_settings as a string', { skip }, async () => {
  const response = await client.company.get();

  assert.ok(response.company, 'master data should be nested under `company`');
  assert.equal(typeof response.company.ui_settings, 'string');
  assert.doesNotThrow(() => JSON.parse(response.company.ui_settings));
});

test('list endpoints return rows under the keys the README documents', { skip }, async () => {
  const checks = [
    ['order.list', 'order', await client.order.list({ limit: 1 })],
    ['suborder.list', 'suborder', await client.suborder.list({ limit: 1 })],
    ['object.list', 'objects', await client.object.list('purchase', { limit: 1 })],
    ['order.listModule', 'objects', await client.order.listModule('timereg', undefined, undefined, { limit: 1 })],
    ['object.listRelations', 'objects', await client.object.listRelations('genobj', 'crm', undefined, { limit: 1 })],
    ['util.listDocuments', 'object', await client.util.listDocuments('genobj', { limit: 1 })],
    ['user.list', 'users', await client.user.list({ limit: 1 })],
    ['user.listGroups', 'group', await client.user.listGroups({ limit: 1 })],
    ['company.listDepartments', 'depts', await client.company.listDepartments({ limit: 1 })],
  ];

  for (const [method, key, response] of checks) {
    assert.ok(
      Array.isArray(response[key]),
      `${method}: rows not under \`${key}\`, got keys: ${Object.keys(response)}`
    );
  }
});
