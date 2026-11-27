import { randomUUID } from 'crypto';
import type {
	IDataObject,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
	IN8nHttpFullResponse,
	INodeProperties,
} from 'n8n-workflow';

/** Fields kept when Simplify is on for a virtual machine. */
const SIMPLE_VM_FIELDS = [
	'id',
	'hostname',
	'operationStatus',
	'ipv4',
	'ipv6',
	'distro',
	'regionCity',
	'tags',
	'planCode',
	'providerName',
];

/** Returns only the most useful fields of each virtual machine when Simplify is on. */
export async function simplifyVirtualMachines(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const simplify = this.getNodeParameter('simplify', true) as boolean;
	if (!simplify) return items;
	return items.map((item) => {
		const simple: IDataObject = {};
		for (const key of SIMPLE_VM_FIELDS) {
			if (item.json[key] !== undefined) simple[key] = item.json[key];
		}
		return { ...item, json: simple };
	});
}

/** Replaces the API's success body with { deleted: true }, as n8n's UX guidelines ask. */
export const deletedOutput = [
	{
		type: 'set' as const,
		properties: {
			value: '={{ { "deleted": true } }}',
		},
	},
];

/** Unwraps a response property such as { sshKey: {...} } into the item itself. */
export function rootProperty(property: string) {
	return [{ type: 'rootProperty' as const, properties: { property } }];
}

/** Splits a comma or newline separated list, dropping empty entries. */
export function splitList(value: unknown): string[] {
	if (Array.isArray(value))
		return value
			.map(String)
			.map((v) => v.trim())
			.filter(Boolean);
	return String(value ?? '')
		.split(/[\n,]/)
		.map((v) => v.trim())
		.filter(Boolean);
}

/**
 * Builds the body of a virtual machine create or reinstall: exactly one access
 * method, list fields as arrays, no empty values, and (for create) an
 * idempotency key, generated when the user left it empty.
 */
export async function prepareVirtualMachineBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const operation = this.getNodeParameter('operation') as string;
	const accessMethod = this.getNodeParameter('accessMethod', 'sshKeys') as string;
	const body: IDataObject = {};

	if (operation === 'create') {
		body.hostname = this.getNodeParameter('hostname') as string;
		body.planId = this.getNodeParameter('planId') as string;
		body.regionId = this.getNodeParameter('regionId') as string;
	}
	const distro = this.getNodeParameter('distro', '') as string;
	if (distro) body.distro = distro;

	switch (accessMethod) {
		case 'sshKeys':
			body.sshKeyIds = splitList(this.getNodeParameter('sshKeyIds', []));
			break;
		case 'password':
			body.password = this.getNodeParameter('password', '') as string;
			break;
		case 'userData':
			body.userData = this.getNodeParameter('userData', '') as string;
			break;
		case 'cloudInitUserData':
			body.cloudInitUserDataId = this.getNodeParameter('cloudInitUserDataId', '') as string;
			break;
	}

	const extra = this.getNodeParameter('additionalFields', {}) as IDataObject;
	if (extra.hostname) body.hostname = extra.hostname;
	if (extra.tags) body.tags = splitList(extra.tags);
	if (extra.instantAppId) body.instantAppId = extra.instantAppId;
	if (extra.couponCode) body.coupon = { code: extra.couponCode };
	if (operation === 'create') {
		body.idempotencyKey = (extra.idempotencyKey as string) || randomUUID();
	}

	requestOptions.body = body;
	return requestOptions;
}

/** Sends tags to add and remove as arrays. */
export async function prepareTagUpdate(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	requestOptions.body = {
		addTags: splitList(this.getNodeParameter('addTags', '')),
		removeTags: splitList(this.getNodeParameter('removeTags', '')),
	};
	return requestOptions;
}

/** Sends a DNS record upsert as { record: { name, type, ttl, rdata } }. */
export async function prepareDnsRecordUpsert(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	requestOptions.body = {
		record: {
			name: (this.getNodeParameter('recordName') as string).trim() || '@',
			type: this.getNodeParameter('recordType') as string,
			ttl: this.getNodeParameter('ttl', 300) as number,
			rdata: splitList(this.getNodeParameter('values')),
		},
	};
	return requestOptions;
}

/** Get Many fields: Return All, or Limit. Paging is done by `paged`. */
export function getManyFields(resource: string, operation = 'getAll'): INodeProperties[] {
	const show = { resource: [resource], operation: [operation] };
	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			displayOptions: { show },
			default: false,
			description: 'Whether to return all results or only up to a given limit',
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			displayOptions: { show: { ...show, returnAll: [false] } },
			typeOptions: { minValue: 1 },
			default: 50,
			description: 'Max number of results to return',
		},
	];
}

/** The API's largest page size. */
export const PAGE_SIZE = 100;

/** Query string of the first page of a list request. */
export const pagedQuery = { page: 0, pageSize: PAGE_SIZE };

type PathFn = (ctx: IExecuteSingleFunctions) => string;
type QueryFn = (ctx: IExecuteSingleFunctions) => IDataObject;

/** Value of a resource locator parameter. */
export function locatorValue(ctx: IExecuteSingleFunctions, name: string): string {
	return encodeURIComponent(String(ctx.getNodeParameter(name, '', { extractValue: true })));
}

/**
 * Output of a Get Many operation: unwraps rootProperty from the first page and,
 * while more rows are needed (Return All, or a Limit above one page), reads the
 * following pages with the same path and filters.
 */
export function paged(property: string, path: string | PathFn, query?: QueryFn) {
	return async function (
		this: IExecuteSingleFunctions,
		_items: INodeExecutionData[],
		response: IN8nHttpFullResponse,
	): Promise<INodeExecutionData[]> {
		const body = (response.body ?? {}) as IDataObject;
		let rows = ((body[property] as IDataObject[] | undefined) ?? []).slice();
		const returnAll = this.getNodeParameter('returnAll', false) as boolean;
		const limit = returnAll ? Infinity : (this.getNodeParameter('limit', 50) as number);
		const total = Number(body.totalCount ?? rows.length);
		const credentials = await this.getCredentials('nodeRingsApi');
		const baseUrl = String(credentials.baseUrl || 'https://api.noderings.com').replace(/\/+$/, '');
		const url = baseUrl + (typeof path === 'string' ? path : path(this));
		let lastPage = rows.length;
		for (
			let page = 1;
			rows.length < limit && rows.length < total && lastPage >= PAGE_SIZE && page < 1000;
			page++
		) {
			const next = (await this.helpers.httpRequestWithAuthentication.call(this, 'nodeRingsApi', {
				method: 'GET',
				url,
				qs: { ...(query ? query(this) : {}), page, pageSize: PAGE_SIZE },
				json: true,
			})) as IDataObject;
			const more = (next[property] as IDataObject[] | undefined) ?? [];
			rows = rows.concat(more);
			lastPage = more.length;
		}
		return rows.slice(0, limit === Infinity ? undefined : limit).map((json) => ({ json }));
	};
}

/** Turns { tags: ["a", "b"] } into one item per tag. */
export async function tagsToItems(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const tags = (items[0]?.json.tags as string[] | undefined) ?? [];
	return tags.map((tag) => ({ json: { tag } }));
}
