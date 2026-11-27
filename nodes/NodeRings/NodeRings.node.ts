import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import {
	cloudInitDescription,
	dnsRecordDescription,
	dnsZoneDescription,
	firewallRulesetDescription,
	sshKeyDescription,
} from './resources/account';
import {
	backupDescription,
	marketplaceDescription,
	snapshotDescription,
	tagDescription,
} from './resources/machineData';
import { virtualMachineDescription } from './resources/virtualMachine';
import {
	getCloudInitOptions,
	getCloudInitUserData,
	getDistros,
	getDnsZones,
	getFirewallRulesets,
	getSshKeyOptions,
	getSshKeys,
	getVirtualMachines,
} from './listSearch';

export class NodeRings implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NodeRings',
		name: 'nodeRings',
		icon: { light: 'file:../../icons/noderings.svg', dark: 'file:../../icons/noderings.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Create and manage NodeRings virtual machines, DNS, SSH keys, firewalls, snapshots and backups',
		defaults: { name: 'NodeRings' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'nodeRingsApi', required: true }],
		requestDefaults: {
			baseURL: '={{$credentials.baseUrl}}',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				default: 'virtualMachine',
				options: [
					{ name: 'Backup', value: 'backup' },
					{ name: 'Cloud-Init User Data', value: 'cloudInitUserData' },
					{ name: 'DNS Record', value: 'dnsRecord' },
					{ name: 'DNS Zone', value: 'dnsZone' },
					{ name: 'Firewall Ruleset', value: 'firewallRuleset' },
					{ name: 'Marketplace', value: 'marketplace' },
					{ name: 'Snapshot', value: 'snapshot' },
					{ name: 'SSH Key', value: 'sshKey' },
					{ name: 'Tag', value: 'tag' },
					{ name: 'Virtual Machine', value: 'virtualMachine' },
				],
			},
			...virtualMachineDescription,
			...sshKeyDescription,
			...dnsZoneDescription,
			...dnsRecordDescription,
			...firewallRulesetDescription,
			...snapshotDescription,
			...backupDescription,
			...cloudInitDescription,
			...tagDescription,
			...marketplaceDescription,
		],
	};

	methods = {
		listSearch: {
			getVirtualMachines,
			getSshKeys,
			getDnsZones,
			getFirewallRulesets,
			getCloudInitUserData,
		},
		loadOptions: {
			getDistros,
			getSshKeyOptions,
			getCloudInitOptions,
		},
	};
}
