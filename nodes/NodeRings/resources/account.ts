import type { IDataObject, INodeProperties } from 'n8n-workflow';
import {
	cloudInitLocator,
	dnsZoneLocator,
	firewallRulesetLocator,
	idPath,
	sshKeyLocator,
} from '../shared/descriptions';
import {
	deletedOutput,
	getManyFields,
	locatorValue,
	paged,
	pagedQuery,
	prepareDnsRecordUpsert,
	rootProperty,
} from '../shared/utils';

const show = (resource: string, operation: string[]) => ({
	show: { resource: [resource], operation },
});

function operations(
	resource: string,
	defaultOp: string,
	options: INodeProperties['options'],
): INodeProperties {
	return {
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: [resource] } },
		default: defaultOp,
		options,
	};
}

const forceField = (resource: string, what: string): INodeProperties => ({
	displayName: 'Force',
	name: 'force',
	type: 'boolean',
	default: false,
	displayOptions: show(resource, ['delete']),
	description: `Whether to delete the ${what} even if it is still in use`,
	routing: {
		send: { type: 'query', property: 'force', value: '={{ $value ? "true" : undefined }}' },
	},
});

// ---------------------------------------------------------------- SSH Key

const sshKeyPath = `=/v1/ssh-keys/${idPath('sshKeyId')}`;

export const sshKeyDescription: INodeProperties[] = [
	operations('sshKey', 'getAll', [
		{
			name: 'Create',
			value: 'create',
			action: 'Create an SSH key',
			description: 'Save a public key to install on new virtual machines',
			routing: {
				request: {
					method: 'POST',
					url: '/v1/ssh-keys',
					body: { name: '={{ $parameter.name }}', publicKey: '={{ $parameter.publicKey.trim() }}' },
				},
				output: { postReceive: rootProperty('sshKey') },
			},
		},
		{
			name: 'Delete',
			value: 'delete',
			action: 'Delete an SSH key',
			routing: {
				request: { method: 'DELETE', url: sshKeyPath },
				output: { postReceive: deletedOutput },
			},
		},
		{
			name: 'Get',
			value: 'get',
			action: 'Get an SSH key',
			routing: {
				request: { method: 'GET', url: sshKeyPath },
				output: { postReceive: rootProperty('sshKey') },
			},
		},
		{
			name: 'Get Many',
			value: 'getAll',
			action: 'Get many SSH keys',
			routing: {
				request: { method: 'GET', url: '/v1/ssh-keys', qs: pagedQuery },
				output: { postReceive: [paged('sshKeys', '/v1/ssh-keys')] },
			},
		},
	]),
	{ ...sshKeyLocator, displayOptions: show('sshKey', ['delete', 'get']) },
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. laptop',
		displayOptions: show('sshKey', ['create']),
	},
	{
		displayName: 'Public Key',
		name: 'publicKey',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		required: true,
		placeholder: 'e.g. ssh-ed25519 AAAA... user@host',
		displayOptions: show('sshKey', ['create']),
		description: 'The public key, in OpenSSH format',
	},
	...getManyFields('sshKey'),
];

// ---------------------------------------------------------------- DNS Zone

const zonePath = `=/v1/dns/zones/${idPath('zoneId')}`;

export const dnsZoneDescription: INodeProperties[] = [
	operations('dnsZone', 'getAll', [
		{
			name: 'Create',
			value: 'create',
			action: 'Create a DNS zone',
			description: 'Host a new, empty zone. Point your domain at the nameservers in the result.',
			routing: {
				request: {
					method: 'POST',
					url: '/v1/dns/zones',
					body: { name: '={{ $parameter.zoneName.trim() }}' },
				},
				output: { postReceive: rootProperty('zone') },
			},
		},
		{
			name: 'Delete',
			value: 'delete',
			action: 'Delete a DNS zone',
			description: 'Delete a zone and all of its records',
			routing: {
				request: { method: 'DELETE', url: zonePath },
				output: { postReceive: deletedOutput },
			},
		},
		{
			name: 'Get',
			value: 'get',
			action: 'Get a DNS zone',
			routing: {
				request: { method: 'GET', url: zonePath },
				output: { postReceive: rootProperty('zone') },
			},
		},
		{
			name: 'Get Many',
			value: 'getAll',
			action: 'Get many DNS zones',
			routing: {
				request: { method: 'GET', url: '/v1/dns/zones', qs: pagedQuery },
				output: { postReceive: [paged('zones', '/v1/dns/zones')] },
			},
		},
	]),
	{ ...dnsZoneLocator, displayOptions: show('dnsZone', ['delete', 'get']) },
	{
		displayName: 'Zone Name',
		name: 'zoneName',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. example.com',
		displayOptions: show('dnsZone', ['create']),
	},
	forceField('dnsZone', 'zone'),
	...getManyFields('dnsZone'),
];

// ---------------------------------------------------------------- DNS Record

const RECORD_TYPES = ['A', 'AAAA', 'CAA', 'CNAME', 'MX', 'NS', 'PTR', 'SRV', 'TXT'].map((t) => ({
	name: t,
	value: t,
}));

export const dnsRecordDescription: INodeProperties[] = [
	operations('dnsRecord', 'getAll', [
		{
			name: 'Create or Update',
			value: 'upsert',
			action: 'Create or update a DNS record',
			description: 'Create a new record, or update the current one if it already exists (upsert)',
			routing: {
				send: { preSend: [prepareDnsRecordUpsert] },
				request: { method: 'PUT', url: `${zonePath}/records` },
			},
		},
		{
			name: 'Delete',
			value: 'delete',
			action: 'Delete a DNS record',
			description: 'Delete a record set (every value of the name and type)',
			routing: {
				request: {
					method: 'DELETE',
					url: `${zonePath}/records`,
					qs: {
						name: '={{ $parameter.recordName.trim() || "@" }}',
						type: '={{ $parameter.recordType }}',
					},
				},
				output: { postReceive: deletedOutput },
			},
		},
		{
			name: 'Get Many',
			value: 'getAll',
			action: 'Get many DNS records',
			routing: {
				request: { method: 'GET', url: `${zonePath}/records`, qs: pagedQuery },
				output: {
					postReceive: [
						paged(
							'records',
							(ctx) => `/v1/dns/zones/${locatorValue(ctx, 'zoneId')}/records`,
							(ctx) => {
								const f = ctx.getNodeParameter('filters', {}) as IDataObject;
								return { ...(f.name ? { name: f.name } : {}), ...(f.type ? { type: f.type } : {}) };
							},
						),
					],
				},
			},
		},
	]),
	{ ...dnsZoneLocator, displayOptions: { show: { resource: ['dnsRecord'] } } },
	{
		displayName: 'Name',
		name: 'recordName',
		type: 'string',
		default: '',
		placeholder: 'e.g. www',
		displayOptions: show('dnsRecord', ['upsert', 'delete']),
		description: 'Name relative to the zone. Use @ or leave empty for the zone apex.',
	},
	{
		displayName: 'Type',
		name: 'recordType',
		type: 'options',
		default: 'A',
		options: RECORD_TYPES,
		displayOptions: show('dnsRecord', ['upsert', 'delete']),
	},
	{
		displayName: 'Values',
		name: 'values',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		required: true,
		placeholder: 'e.g. 203.0.113.10',
		displayOptions: show('dnsRecord', ['upsert']),
		description:
			'One value per line (or comma-separated). For MX use "10 mail.example.com.", for TXT the text itself.',
	},
	{
		displayName: 'TTL',
		name: 'ttl',
		type: 'number',
		typeOptions: { minValue: 60 },
		default: 300,
		displayOptions: show('dnsRecord', ['upsert']),
		description: 'Time to live in seconds',
	},
	...getManyFields('dnsRecord'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show('dnsRecord', ['getAll']),
		options: [
			{
				displayName: 'Name Contains',
				name: 'name',
				type: 'string',
				default: '',
				routing: { send: { type: 'query', property: 'name' } },
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				default: 'A',
				options: RECORD_TYPES,
				routing: { send: { type: 'query', property: 'type' } },
			},
		],
	},
];

// ---------------------------------------------------------------- Firewall Ruleset

const rulesetPath = `=/v1/firewall/rulesets/${idPath('rulesetId')}`;

export const firewallRulesetDescription: INodeProperties[] = [
	operations('firewallRuleset', 'getAll', [
		{
			name: 'Create',
			value: 'create',
			action: 'Create a firewall ruleset',
			routing: {
				request: {
					method: 'POST',
					url: '/v1/firewall/rulesets',
					body: { ruleset: { name: '={{ $parameter.rulesetName }}' } },
				},
				output: { postReceive: rootProperty('ruleset') },
			},
		},
		{
			name: 'Delete',
			value: 'delete',
			action: 'Delete a firewall ruleset',
			routing: {
				request: { method: 'DELETE', url: rulesetPath },
				output: { postReceive: deletedOutput },
			},
		},
		{
			name: 'Get',
			value: 'get',
			action: 'Get a firewall ruleset',
			routing: { request: { method: 'GET', url: rulesetPath } },
		},
		{
			name: 'Get Many',
			value: 'getAll',
			action: 'Get many firewall rulesets',
			routing: {
				request: { method: 'GET', url: '/v1/firewall/rulesets', qs: pagedQuery },
				output: { postReceive: [paged('rulesets', '/v1/firewall/rulesets')] },
			},
		},
		{
			name: 'Rename',
			value: 'update',
			action: 'Rename a firewall ruleset',
			routing: {
				request: {
					method: 'PATCH',
					url: rulesetPath,
					body: { ruleset: { name: '={{ $parameter.rulesetName }}' } },
				},
			},
		},
	]),
	{
		...firewallRulesetLocator,
		displayOptions: show('firewallRuleset', ['delete', 'get', 'update']),
	},
	{
		displayName: 'Name',
		name: 'rulesetName',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. web servers',
		displayOptions: show('firewallRuleset', ['create', 'update']),
	},
	forceField('firewallRuleset', 'ruleset'),
	...getManyFields('firewallRuleset'),
];

// ---------------------------------------------------------------- Cloud-init user data

const cloudInitPath = `=/v1/cloudinituserdata/${idPath('cloudInitId')}`;

export const cloudInitDescription: INodeProperties[] = [
	operations('cloudInitUserData', 'getAll', [
		{
			name: 'Create',
			value: 'create',
			action: 'Create cloud-init user data',
			description: 'Save cloud-init user data to reuse when creating virtual machines',
			routing: {
				request: {
					method: 'POST',
					url: '/v1/cloudinituserdata',
					body: {
						name: '={{ $parameter.profileName }}',
						userData: '={{ $parameter.profileUserData }}',
						description: '={{ $parameter.profileDescription || undefined }}',
					},
				},
			},
		},
		{
			name: 'Delete',
			value: 'delete',
			action: 'Delete cloud-init user data',
			routing: {
				request: { method: 'DELETE', url: cloudInitPath },
				output: { postReceive: deletedOutput },
			},
		},
		{
			name: 'Get',
			value: 'get',
			action: 'Get cloud-init user data',
			routing: { request: { method: 'GET', url: cloudInitPath } },
		},
		{
			name: 'Get Many',
			value: 'getAll',
			action: 'Get many cloud-init user data',
			routing: {
				request: { method: 'GET', url: '/v1/cloudinituserdata', qs: pagedQuery },
				output: { postReceive: [paged('profiles', '/v1/cloudinituserdata')] },
			},
		},
		{
			name: 'Update',
			value: 'update',
			action: 'Update cloud-init user data',
			routing: {
				request: {
					method: 'PATCH',
					url: cloudInitPath,
					body: {
						name: '={{ $parameter.profileName }}',
						userData: '={{ $parameter.profileUserData }}',
						description: '={{ $parameter.profileDescription || undefined }}',
					},
				},
			},
		},
	]),
	{ ...cloudInitLocator, displayOptions: show('cloudInitUserData', ['delete', 'get', 'update']) },
	{
		displayName: 'Name',
		name: 'profileName',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. docker host',
		displayOptions: show('cloudInitUserData', ['create', 'update']),
	},
	{
		displayName: 'User Data',
		name: 'profileUserData',
		type: 'string',
		typeOptions: { rows: 8 },
		default: '',
		required: true,
		placeholder: '#cloud-config',
		displayOptions: show('cloudInitUserData', ['create', 'update']),
	},
	{
		displayName: 'Description',
		name: 'profileDescription',
		type: 'string',
		default: '',
		displayOptions: show('cloudInitUserData', ['create', 'update']),
	},
	...getManyFields('cloudInitUserData'),
];
