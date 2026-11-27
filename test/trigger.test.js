'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { NodeRingsTrigger } = require('../dist/nodes/NodeRingsTrigger/NodeRingsTrigger.node.js');
const { context } = require('./fakes.js');

const vm = (id, status, extra = {}) => ({ id, hostname: `vm-${id}`, operationStatus: status, createTime: `2026-01-0${id}`, ...extra });

async function poll(event, list, staticData, mode = 'trigger') {
	const ctx = context({ params: { event }, staticData, mode, pages: () => ({ virtualMachines: list, totalCount: list.length }) });
	const out = await new NodeRingsTrigger().poll.call(ctx);
	return out ? out[0].map((i) => i.json) : [];
}

test('new virtual machine: first poll is silent, then only new ones', async () => {
	const state = {};
	assert.deepEqual(await poll('newVirtualMachine', [vm('1', 'S')], state), []);
	const out = await poll('newVirtualMachine', [vm('1', 'S'), vm('2', 'C')], state);
	assert.deepEqual(out.map((v) => v.id), ['2']);
	assert.deepEqual(await poll('newVirtualMachine', [vm('1', 'S'), vm('2', 'C')], state), []);
});

test('status change reports previous status, and deletions with the hostname', async () => {
	const state = {};
	await poll('statusChange', [vm('1', 'STARTED'), vm('2', 'STARTED')], state);
	let out = await poll('statusChange', [vm('1', 'STOPPED'), vm('2', 'STARTED')], state);
	assert.equal(out.length, 1);
	assert.equal(out[0].previousStatus, 'STARTED');
	assert.equal(out[0].operationStatus, 'STOPPED');
	out = await poll('statusChange', [vm('1', 'STOPPED')], state);
	assert.equal(out[0].id, '2');
	assert.equal(out[0].hostname, 'vm-2');
	assert.equal(out[0].operationStatus, 'OPERATION_STATUS_DELETED');
});

test('ip assigned fires once, when the first address appears', async () => {
	const state = {};
	await poll('ipAssigned', [vm('1', 'C')], state);
	let out = await poll('ipAssigned', [vm('1', 'C', { ipv4: '203.0.113.5' })], state);
	assert.deepEqual(out.map((v) => v.ipv4), ['203.0.113.5']);
	out = await poll('ipAssigned', [vm('1', 'S', { ipv4: '203.0.113.5' })], state);
	assert.deepEqual(out, []);
});

test('a manual test run returns the newest VM and leaves the state alone', async () => {
	const state = {};
	const out = await poll('newVirtualMachine', [vm('1', 'S'), vm('3', 'S'), vm('2', 'S')], state, 'manual');
	assert.equal(out[0].id, '3');
	assert.deepEqual(state, {});
});
