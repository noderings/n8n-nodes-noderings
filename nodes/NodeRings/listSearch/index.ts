import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeListSearchResult,
	INodePropertyOptions,
} from 'n8n-workflow';
import { nodeRingsApiRequest, nodeRingsApiRequestAllItems } from '../shared/transport';

function matches(filter: string | undefined, ...values: unknown[]): boolean {
	if (!filter) return true;
	const f = filter.toLowerCase();
	return values.some((v) =>
		String(v ?? '')
			.toLowerCase()
			.includes(f),
	);
}

async function search(
	ctx: ILoadOptionsFunctions,
	path: string,
	rootProperty: string,
	filter: string | undefined,
	toItem: (item: IDataObject) => { name: string; value: string; search: unknown[] },
): Promise<INodeListSearchResult> {
	const items = await nodeRingsApiRequestAllItems.call(ctx, path, rootProperty);
	const results = items
		.map(toItem)
		.filter((r) => matches(filter, ...r.search))
		.map(({ name, value }) => ({ name, value }))
		.sort((a, b) => a.name.localeCompare(b.name));
	return { results };
}

export async function getVirtualMachines(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	return await search(this, '/v1/virtual-machines', 'virtualMachines', filter, (vm) => ({
		name: `${vm.hostname} (${vm.ipv4 || vm.ipv6 || 'no IP yet'})`,
		value: String(vm.id),
		search: [vm.hostname, vm.ipv4, vm.ipv6, vm.id],
	}));
}

export async function getSshKeys(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	return await search(this, '/v1/ssh-keys', 'sshKeys', filter, (key) => ({
		name: String(key.name),
		value: String(key.id),
		search: [key.name, key.id],
	}));
}

export async function getDnsZones(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	return await search(this, '/v1/dns/zones', 'zones', filter, (zone) => ({
		name: String(zone.name),
		value: String(zone.id),
		search: [zone.name, zone.id],
	}));
}

export async function getFirewallRulesets(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	return await search(this, '/v1/firewall/rulesets', 'rulesets', filter, (rs) => ({
		name: String(rs.name),
		value: String(rs.id),
		search: [rs.name, rs.id],
	}));
}

export async function getCloudInitUserData(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	return await search(this, '/v1/cloudinituserdata', 'profiles', filter, (p) => ({
		name: String(p.name),
		value: String(p.id),
		search: [p.name, p.id],
	}));
}

/** Distro catalog for the Distro dropdown, with the API's own labels. */
export async function getDistros(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const response = await nodeRingsApiRequest.call(this, 'GET', '/v1/distros');
	const distros = (response.distros as IDataObject[] | undefined) ?? [];
	return distros.map((d) => ({
		name: String(d.label || d.name || d.distro),
		value: String(d.distro),
	}));
}

/** SSH keys for the SSH Keys multi-select. */
export async function getSshKeyOptions(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const keys = await nodeRingsApiRequestAllItems.call(this, '/v1/ssh-keys', 'sshKeys');
	return keys.map((k) => ({ name: String(k.name), value: String(k.id) }));
}
