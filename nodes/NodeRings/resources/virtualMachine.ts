import type { IDataObject, INodeProperties } from 'n8n-workflow';
import {
	firewallRulesetLocator,
	idPath,
	simplifyField,
	virtualMachineLocator,
} from '../shared/descriptions';
import {
	deletedOutput,
	getManyFields,
	paged,
	pagedQuery,
	prepareTagUpdate,
	prepareVirtualMachineBody,
	rootProperty,
	simplifyVirtualMachines,
} from '../shared/utils';

const resource = 'virtualMachine';
const show = (operation: string[]) => ({ show: { resource: [resource], operation } });
const vmPath = `=/v1/virtual-machines/${idPath('virtualMachineId')}`;

const STATUSES = [
	{ name: 'Created', value: 'OPERATION_STATUS_CREATED' },
	{ name: 'Deleted', value: 'OPERATION_STATUS_DELETED' },
	{ name: 'Reinstalling', value: 'OPERATION_STATUS_REINSTALLING' },
	{ name: 'Restarted', value: 'OPERATION_STATUS_RESTARTED' },
	{ name: 'Started', value: 'OPERATION_STATUS_STARTED' },
	{ name: 'Stopped', value: 'OPERATION_STATUS_STOPPED' },
];

const simplifiedVm = [...rootProperty('virtualMachine'), simplifyVirtualMachines];

/** Distro and access-method fields shared by Create and Reinstall. */
function installFields(operations: string[]): INodeProperties[] {
	return [
		{
			displayName: 'Distro Name or ID',
			name: 'distro',
			type: 'options',
			typeOptions: { loadOptionsMethod: 'getDistros' },
			required: operations.includes('create'),
			default: '',
			displayOptions: show(operations),
			description:
				'Operating system to install. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		},
		{
			displayName: 'Access Method',
			name: 'accessMethod',
			type: 'options',
			default: 'sshKeys',
			displayOptions: show(operations),
			description:
				'How you will log in. The API accepts exactly one access method. Cloud-init user data is no longer accepted.',
			options: [
				{ name: 'SSH Keys', value: 'sshKeys', description: 'Install SSH keys saved in NodeRings' },
				{ name: 'Password', value: 'password', description: 'Set a root password' },
			],
		},
		{
			displayName: 'SSH Key Names or IDs',
			name: 'sshKeyIds',
			type: 'multiOptions',
			typeOptions: { loadOptionsMethod: 'getSshKeyOptions' },
			default: [],
			required: true,
			displayOptions: {
				show: { resource: [resource], operation: operations, accessMethod: ['sshKeys'] },
			},
			description:
				'SSH keys to install. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			displayOptions: {
				show: { resource: [resource], operation: operations, accessMethod: ['password'] },
			},
			description: 'Root password for the virtual machine',
		},
	];
}

export const virtualMachineDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: [resource] } },
		default: 'getAll',
		options: [
			{
				name: 'Attach Firewall',
				value: 'attachFirewall',
				action: 'Attach a firewall ruleset to a virtual machine',
				description: 'Attach a firewall ruleset, replacing any ruleset already attached',
				routing: {
					request: {
						method: 'POST',
						url: `${vmPath}:attach-firewall`,
						body: { rulesetId: '={{ $parameter.rulesetId }}' },
					},
				},
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create a virtual machine',
				description: 'Order a new virtual machine. It is billed from the moment it is created.',
				routing: {
					send: { preSend: [prepareVirtualMachineBody] },
					request: { method: 'POST', url: '/v1/virtual-machines' },
					output: { postReceive: simplifiedVm },
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a virtual machine',
				description:
					'Delete a virtual machine with its snapshots and backups. This cannot be undone.',
				routing: {
					request: { method: 'DELETE', url: vmPath },
					output: { postReceive: deletedOutput },
				},
			},
			{
				name: 'Detach Firewall',
				value: 'detachFirewall',
				action: 'Detach a firewall ruleset from a virtual machine',
				routing: {
					request: {
						method: 'POST',
						url: `${vmPath}:detach-firewall`,
						body: { rulesetId: '={{ $parameter.rulesetId }}' },
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a virtual machine',
				routing: {
					request: { method: 'GET', url: vmPath },
					output: { postReceive: [simplifyVirtualMachines] },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many virtual machines',
				routing: {
					request: { method: 'GET', url: '/v1/virtual-machines', qs: pagedQuery },
					output: {
						postReceive: [
							paged('virtualMachines', '/v1/virtual-machines', (ctx) => {
								const status = (ctx.getNodeParameter('filters', {}) as IDataObject).status;
								return status ? { filterOperationStatus: status } : {};
							}),
							simplifyVirtualMachines,
						],
					},
				},
			},
			{
				name: 'Reinstall',
				value: 'reinstall',
				action: 'Reinstall a virtual machine',
				description: 'Reinstall the operating system. This wipes the disk and deletes snapshots.',
				routing: {
					send: { preSend: [prepareVirtualMachineBody] },
					request: { method: 'POST', url: `${vmPath}:reinstall` },
					output: { postReceive: [simplifyVirtualMachines] },
				},
			},
			{
				name: 'Restart',
				value: 'restart',
				action: 'Restart a virtual machine',
				description: 'Restart a running virtual machine',
				routing: {
					request: { method: 'POST', url: `${vmPath}:restart`, body: {} },
					output: { postReceive: [simplifyVirtualMachines] },
				},
			},
			{
				name: 'Start',
				value: 'start',
				action: 'Start a virtual machine',
				description: 'Power on a stopped virtual machine',
				routing: {
					request: { method: 'POST', url: `${vmPath}:start`, body: {} },
					output: { postReceive: [simplifyVirtualMachines] },
				},
			},
			{
				name: 'Stop',
				value: 'stop',
				action: 'Stop a virtual machine',
				description: 'Power off a virtual machine. Billing continues while it is stopped.',
				routing: {
					request: { method: 'POST', url: `${vmPath}:stop`, body: {} },
					output: { postReceive: [simplifyVirtualMachines] },
				},
			},
			{
				name: 'Update Tags',
				value: 'updateTags',
				action: 'Update the tags of a virtual machine',
				description: 'Add and remove tags. Tags are the only thing the API can change in place.',
				routing: {
					send: { preSend: [prepareTagUpdate] },
					request: { method: 'PATCH', url: vmPath },
					output: { postReceive: [simplifyVirtualMachines] },
				},
			},
		],
	},
	{
		...virtualMachineLocator,
		displayOptions: show([
			'attachFirewall',
			'delete',
			'detachFirewall',
			'get',
			'reinstall',
			'restart',
			'start',
			'stop',
			'updateTags',
		]),
	},
	{ ...firewallRulesetLocator, displayOptions: show(['attachFirewall', 'detachFirewall']) },

	// Get Many
	...getManyFields(resource),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show(['getAll']),
		options: [
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				default: 'OPERATION_STATUS_STARTED',
				options: STATUSES,
				description: 'Only return virtual machines in this state',
				routing: { send: { type: 'query', property: 'filterOperationStatus' } },
			},
		],
	},

	// Create
	{
		displayName: 'Hostname',
		name: 'hostname',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. web-1',
		displayOptions: show(['create']),
	},
	{
		displayName: 'Plan ID',
		name: 'planId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 81dea236-1453-484c-aaf2-564a30aa353b',
		displayOptions: show(['create']),
		description:
			"Marketplace plan to order. Find it with Marketplace, Get Many Offers (the offer's planId).",
	},
	{
		displayName: 'Region ID',
		name: 'regionId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 506ab941-39ff-4dea-9869-b853284b39a5',
		displayOptions: show(['create']),
		description:
			'Region of the plan. Find it with Marketplace, Get Many Offers (planRegions[].regionId) or Get Plan.',
	},
	...installFields(['create', 'reinstall']),
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['create']),
		options: [
			{
				displayName: 'Coupon Code',
				name: 'couponCode',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Idempotency Key',
				name: 'idempotencyKey',
				type: 'string',
				default: '',
				placeholder: 'e.g. 3f1c2a9e-6b1d-4c8e-9a7f-2d5e8b0c4a11',
				description:
					'UUID that makes a retried create safe. Leave empty to generate one. Reuse the same key when you retry a create that may already have gone through.',
			},
			{
				displayName: 'Instant App ID',
				name: 'instantAppId',
				type: 'string',
				default: '',
				description: 'Instant app to install',
			},
			{
				displayName: 'Tags',
				name: 'tags',
				type: 'string',
				default: '',
				placeholder: 'e.g. web, production',
				description: 'Comma-separated tags',
			},
		],
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['reinstall']),
		options: [
			{
				displayName: 'Hostname',
				name: 'hostname',
				type: 'string',
				default: '',
				description: 'New hostname. Leave empty to keep the current one.',
			},
			{
				displayName: 'Instant App ID',
				name: 'instantAppId',
				type: 'string',
				default: '',
			},
		],
	},

	// Update Tags
	{
		displayName: 'Add Tags',
		name: 'addTags',
		type: 'string',
		default: '',
		placeholder: 'e.g. web, production',
		displayOptions: show(['updateTags']),
		description: 'Comma-separated tags to add',
	},
	{
		displayName: 'Remove Tags',
		name: 'removeTags',
		type: 'string',
		default: '',
		placeholder: 'e.g. staging',
		displayOptions: show(['updateTags']),
		description: 'Comma-separated tags to remove',
	},

	simplifyField(resource, [
		'create',
		'get',
		'getAll',
		'reinstall',
		'restart',
		'start',
		'stop',
		'updateTags',
	]),
];
