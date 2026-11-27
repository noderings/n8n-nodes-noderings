'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const utils = require('../dist/nodes/NodeRings/shared/utils.js');
const { context } = require('./fakes.js');

test('splitList accepts commas, newlines and arrays', () => {
	assert.deepEqual(utils.splitList('a, b\n c,,'), ['a', 'b', 'c']);
	assert.deepEqual(utils.splitList([' x ', '']), ['x']);
	assert.deepEqual(utils.splitList(undefined), []);
});

test('create body sends exactly one access method and an idempotency key', async () => {
	const ctx = context({
		params: {
			operation: 'create',
			hostname: 'web-1',
			planId: 'p',
			regionId: 'r',
			distro: 'DISTRO_UBUNTU_26_04',
			accessMethod: 'sshKeys',
			sshKeyIds: ['k1', 'k2'],
			password: 'should-not-be-sent',
			userData: '#cloud-config',
			additionalFields: { tags: 'web, prod', couponCode: 'SAVE' },
		},
	});
	const { body } = await utils.prepareVirtualMachineBody.call(ctx, {});
	assert.deepEqual(body.sshKeyIds, ['k1', 'k2']);
	assert.equal(body.password, undefined);
	assert.equal(body.userData, undefined);
	assert.deepEqual(body.tags, ['web', 'prod']);
	assert.deepEqual(body.coupon, { code: 'SAVE' });
	assert.match(body.idempotencyKey, /^[0-9a-f-]{36}$/);
});

test('create keeps a given idempotency key; reinstall sends none', async () => {
	const create = context({
		params: { operation: 'create', hostname: 'h', planId: 'p', regionId: 'r', accessMethod: 'password', password: 'pw', additionalFields: { idempotencyKey: 'fixed-key' } },
	});
	assert.equal((await utils.prepareVirtualMachineBody.call(create, {})).body.idempotencyKey, 'fixed-key');
	const reinstall = context({ params: { operation: 'reinstall', accessMethod: 'password', password: 'pw', additionalFields: {} } });
	const { body } = await utils.prepareVirtualMachineBody.call(reinstall, {});
	assert.equal(body.idempotencyKey, undefined);
	assert.equal(body.hostname, undefined);
	assert.deepEqual(Object.keys(body), ['password']);
});

test('cloud-init access methods from older workflows fail before any request', async () => {
	for (const operation of ['create', 'reinstall']) {
		for (const accessMethod of ['userData', 'cloudInitUserData']) {
			const ctx = context({
				params: { operation, hostname: 'h', planId: 'p', regionId: 'r', accessMethod, userData: '#cloud-config', cloudInitUserDataId: 'c', additionalFields: {} },
			});
			await assert.rejects(utils.prepareVirtualMachineBody.call(ctx, {}), /no longer supported/);
			assert.equal(ctx.calls.length, 0);
		}
	}
});

function rows(n, from = 0) {
	return Array.from({ length: n }, (_, i) => ({ id: String(from + i) }));
}

test('paged: Return All reads every page', async () => {
	const ctx = context({ params: { returnAll: true }, pages: [{ items: rows(100, 100), totalCount: 250 }, { items: rows(50, 200), totalCount: 250 }] });
	const out = await utils.paged('items', '/v1/things').call(ctx, [], { body: { items: rows(100), totalCount: 250 } });
	assert.equal(out.length, 250);
	assert.equal(ctx.calls.length, 2);
	assert.deepEqual(ctx.calls.map((c) => c.qs.page), [1, 2]);
	assert.equal(ctx.calls[0].url, 'https://api.example.test/v1/things');
});

test('paged: Limit stops early and keeps filters', async () => {
	const ctx = context({ params: { returnAll: false, limit: 120 }, pages: [{ items: rows(100, 100), totalCount: 300 }] });
	const out = await utils.paged('items', () => '/v1/x', () => ({ filterOperationStatus: 'S' })).call(ctx, [], {
		body: { items: rows(100), totalCount: 300 },
	});
	assert.equal(out.length, 120);
	assert.equal(ctx.calls.length, 1);
	assert.equal(ctx.calls[0].qs.filterOperationStatus, 'S');
});

test('paged: one short page means no more requests', async () => {
	const ctx = context({ params: { returnAll: true } });
	const out = await utils.paged('items', '/v1/x').call(ctx, [], { body: { items: rows(3), totalCount: 3 } });
	assert.equal(out.length, 3);
	assert.equal(ctx.calls.length, 0);
});

test('simplify keeps at most ten fields', async () => {
	const ctx = context({ params: { simplify: true } });
	const vm = { id: '1', hostname: 'h', cpu: 2, memory: 1024, ipv4: '203.0.113.1', tags: ['a'], planId: 'p', extra: 1, a: 1, b: 2, c: 3 };
	const [item] = await utils.simplifyVirtualMachines.call(ctx, [{ json: vm }]);
	assert.ok(Object.keys(item.json).length <= 10);
	assert.equal(item.json.cpu, undefined);
	assert.deepEqual(item.json.tags, ['a']);
});
