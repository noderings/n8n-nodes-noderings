import type { INodeProperties } from 'n8n-workflow';
import { idPath, virtualMachineLocator } from '../shared/descriptions';
import {
	deletedOutput,
	getManyFields,
	locatorValue,
	paged,
	pagedQuery,
	rootProperty,
	tagsToItems,
} from '../shared/utils';

const show = (resource: string, operation: string[]) => ({
	show: { resource: [resource], operation },
});
const vmBase = `=/v1/virtual-machines/${idPath('virtualMachineId')}`;

function idField(
	resource: string,
	name: string,
	displayName: string,
	operations: string[],
): INodeProperties {
	return {
		displayName,
		name,
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 7c9e6679-7425-40de-944b-e07fc1f90ae7',
		displayOptions: show(resource, operations),
	};
}

// ---------------------------------------------------------------- Snapshot

const snapshotPath = `${vmBase}/snapshots/${idPath('snapshotId')}`;

export const snapshotDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['snapshot'] } },
		default: 'getAll',
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a snapshot',
				description: 'Take a snapshot of a virtual machine',
				routing: {
					request: {
						method: 'POST',
						url: `${vmBase}/snapshots`,
						body: { description: '={{ $parameter.description || undefined }}' },
					},
					output: { postReceive: rootProperty('snapshot') },
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a snapshot',
				routing: {
					request: { method: 'DELETE', url: snapshotPath },
					output: { postReceive: deletedOutput },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a snapshot',
				routing: {
					request: { method: 'GET', url: snapshotPath },
					output: { postReceive: rootProperty('snapshot') },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many snapshots',
				routing: {
					request: { method: 'GET', url: `${vmBase}/snapshots`, qs: pagedQuery },
					output: {
						postReceive: [
							paged(
								'snapshots',
								(ctx) => `/v1/virtual-machines/${locatorValue(ctx, 'virtualMachineId')}/snapshots`,
							),
						],
					},
				},
			},
			{
				name: 'Restore',
				value: 'restore',
				action: 'Restore a snapshot',
				description:
					'Roll the same virtual machine back to the snapshot. Changes since then are lost.',
				routing: {
					request: {
						method: 'POST',
						url: `${snapshotPath}/restore`,
						body: { stopVm: '={{ $parameter.stopVm }}' },
					},
				},
			},
		],
	},
	{ ...virtualMachineLocator, displayOptions: { show: { resource: ['snapshot'] } } },
	idField('snapshot', 'snapshotId', 'Snapshot ID', ['delete', 'get', 'restore']),
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		default: '',
		placeholder: 'e.g. before upgrade',
		displayOptions: show('snapshot', ['create']),
	},
	{
		displayName: 'Stop VM First',
		name: 'stopVm',
		type: 'boolean',
		default: true,
		displayOptions: show('snapshot', ['restore']),
		description: 'Whether to stop the virtual machine before restoring',
	},
	...getManyFields('snapshot'),
];

// ---------------------------------------------------------------- Backup

const backupPath = `${vmBase}/backups/${idPath('backupId')}`;

export const backupDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['backup'] } },
		default: 'getAll',
		options: [
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a backup',
				routing: {
					request: { method: 'DELETE', url: backupPath },
					output: { postReceive: deletedOutput },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a backup',
				routing: {
					request: { method: 'GET', url: backupPath },
					output: { postReceive: rootProperty('backup') },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many backups',
				routing: {
					request: { method: 'GET', url: `${vmBase}/backups`, qs: pagedQuery },
					output: {
						postReceive: [
							paged(
								'backups',
								(ctx) => `/v1/virtual-machines/${locatorValue(ctx, 'virtualMachineId')}/backups`,
							),
						],
					},
				},
			},
			{
				name: 'Restore',
				value: 'restore',
				action: 'Restore a backup',
				description: 'Restore the backup onto the same virtual machine, overwriting its disk',
				routing: {
					request: {
						method: 'POST',
						url: `${backupPath}/restore`,
						body: { startAfterRestore: '={{ $parameter.startAfterRestore }}' },
					},
				},
			},
		],
	},
	{ ...virtualMachineLocator, displayOptions: { show: { resource: ['backup'] } } },
	idField('backup', 'backupId', 'Backup ID', ['delete', 'get', 'restore']),
	{
		displayName: 'Start After Restore',
		name: 'startAfterRestore',
		type: 'boolean',
		default: true,
		displayOptions: show('backup', ['restore']),
		description: 'Whether to start the virtual machine when the restore finishes',
	},
	...getManyFields('backup'),
];

// ---------------------------------------------------------------- Tag

export const tagDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['tag'] } },
		default: 'getAll',
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many tags',
				description: 'List every tag used on your virtual machines',
				routing: {
					request: { method: 'GET', url: '/v1/virtual-machines/tags' },
					output: { postReceive: [tagsToItems] },
				},
			},
		],
	},
];

// ---------------------------------------------------------------- Marketplace

const ASSET_TYPE_VM = 'ASSET_TYPE_VM';

export const marketplaceDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['marketplace'] } },
		default: 'getOffers',
		options: [
			{
				name: 'Get Distros',
				value: 'getDistros',
				action: 'Get the distro catalog',
				description: 'Operating systems you can install',
				routing: {
					request: { method: 'GET', url: '/v1/distros' },
					output: { postReceive: rootProperty('distros') },
				},
			},
			{
				name: 'Get Many Offers',
				value: 'getOffers',
				action: 'Get many offers for a plan code',
				description:
					'Providers selling a plan code in a city, with the planId and regionId needed to create a virtual machine',
				routing: {
					request: {
						method: 'GET',
						url: '/v1/marketplace/providers',
						qs: {
							filterPlanCode: '={{ $parameter.planCode }}',
							filterCountry: '={{ $parameter.country }}',
							filterCity: '={{ $parameter.city }}',
							page: 0,
							pageSize: 100,
						},
					},
					output: { postReceive: rootProperty('providers') },
				},
			},
			{
				name: 'Get Many Plan Codes',
				value: 'getPlans',
				action: 'Get many plan codes',
				description: 'Plan codes for sale, optionally in one country and city',
				routing: {
					request: {
						method: 'GET',
						url: '/v1/marketplace/plans',
						qs: {
							filterAssetType: ASSET_TYPE_VM,
							filterCountry: '={{ $parameter.planFilters.country || undefined }}',
							filterCity: '={{ $parameter.planFilters.city || undefined }}',
						},
					},
					output: { postReceive: rootProperty('plans') },
				},
			},
			{
				name: 'Get Many Regions',
				value: 'getRegions',
				action: 'Get many regions',
				description: 'Countries and cities where virtual machines are for sale',
				routing: {
					request: {
						method: 'GET',
						url: '/v1/marketplace/regions',
						qs: { filterAssetType: ASSET_TYPE_VM },
					},
					output: { postReceive: rootProperty('regions') },
				},
			},
			{
				name: 'Get Plan',
				value: 'getPlan',
				action: 'Get a marketplace plan',
				description: 'Details, prices and regions of one plan',
				routing: {
					request: { method: 'GET', url: `=/v1/marketplace/plans/${idPath('planId')}` },
				},
			},
		],
	},
	{
		displayName: 'Plan Code',
		name: 'planCode',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. SC-GC-1C-1G-20',
		displayOptions: show('marketplace', ['getOffers']),
		description: 'A plan code from Get Many Plan Codes',
	},
	{
		displayName: 'Country',
		name: 'country',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. United States',
		displayOptions: show('marketplace', ['getOffers']),
	},
	{
		displayName: 'City',
		name: 'city',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. Ashburn',
		displayOptions: show('marketplace', ['getOffers']),
	},
	{
		displayName: 'Plan ID',
		name: 'planId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 81dea236-1453-484c-aaf2-564a30aa353b',
		displayOptions: show('marketplace', ['getPlan']),
	},
	{
		displayName: 'Filters',
		name: 'planFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show('marketplace', ['getPlans']),
		options: [
			{
				displayName: 'Country',
				name: 'country',
				type: 'string',
				default: '',
				placeholder: 'e.g. Germany',
			},
			{
				displayName: 'City',
				name: 'city',
				type: 'string',
				default: '',
				placeholder: 'e.g. Frankfurt',
			},
		],
	},
];
