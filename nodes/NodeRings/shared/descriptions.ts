import type { INodeProperties } from 'n8n-workflow';

const UUID = '^[0-9a-fA-F-]{36}$';

function locator(
	displayName: string,
	name: string,
	searchListMethod: string,
	description: string,
): INodeProperties {
	return {
		displayName,
		name,
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description,
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				placeholder: `Select a ${displayName.toLowerCase().replace(/ id$/, '')}...`,
				typeOptions: { searchListMethod, searchable: true },
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. 7c9e6679-7425-40de-944b-e07fc1f90ae7',
				validation: [
					{
						type: 'regex',
						properties: { regex: UUID, errorMessage: 'Not a valid NodeRings ID' },
					},
				],
			},
		],
	};
}

export const virtualMachineLocator = locator(
	'Virtual Machine',
	'virtualMachineId',
	'getVirtualMachines',
	'The virtual machine to use',
);

export const sshKeyLocator = locator('SSH Key', 'sshKeyId', 'getSshKeys', 'The SSH key to use');

export const dnsZoneLocator = locator('DNS Zone', 'zoneId', 'getDnsZones', 'The DNS zone to use');

export const firewallRulesetLocator = locator(
	'Firewall Ruleset',
	'rulesetId',
	'getFirewallRulesets',
	'The firewall ruleset to use',
);

export const cloudInitLocator = locator(
	'Cloud Init User Data',
	'cloudInitId',
	'getCloudInitUserData',
	'The saved cloud-init user data to use',
);

/** Path segment of a resource locator parameter, URL-encoded. */
export function idPath(parameter: string): string {
	return `{{ toPathSegment($parameter.${parameter}) }}`;
}

export const simplifyField = (resource: string, operations: string[]): INodeProperties => ({
	displayName: 'Simplify',
	name: 'simplify',
	type: 'boolean',
	default: true,
	displayOptions: { show: { resource: [resource], operation: operations } },
	description: 'Whether to return a simplified version of the response instead of the raw data',
});
