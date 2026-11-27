import {
	NodeConnectionTypes,
	type IDataObject,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type IPollFunctions,
} from 'n8n-workflow';
import { getVirtualMachines } from '../NodeRings/listSearch';
import { nodeRingsApiRequest, nodeRingsApiRequestAllItems } from '../NodeRings/shared/transport';

/** What the trigger remembers between polls. */
type TriggerState = {
	primed?: boolean;
	knownIds?: string[];
	statusById?: Record<string, string>;
	hostnameById?: Record<string, string>;
	ipReadyIds?: string[];
};

export class NodeRingsTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NodeRings Trigger',
		name: 'nodeRingsTrigger',
		icon: { light: 'file:../../icons/noderings.svg', dark: 'file:../../icons/noderings.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle:
			'={{ { newVirtualMachine: "New virtual machine", statusChange: "Status changed", ipAssigned: "IP address assigned" }[$parameter["event"]] }}',
		description: 'Starts a workflow when a NodeRings virtual machine is created or changes state',
		defaults: { name: 'NodeRings Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'nodeRingsApi', required: true }],
		polling: true,
		properties: [
			{
				displayName:
					'NodeRings has no webhooks for these events, so this trigger checks the API on the schedule below. The first check only records what exists; events start from the second.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				default: 'newVirtualMachine',
				options: [
					{
						name: 'New Virtual Machine',
						value: 'newVirtualMachine',
						description: 'A virtual machine appeared that was not there on the previous check',
					},
					{
						name: 'Status Changed',
						value: 'statusChange',
						description:
							'A virtual machine started, stopped, restarted, is reinstalling or was deleted',
					},
					{
						name: 'IP Address Assigned',
						value: 'ipAssigned',
						description: 'A virtual machine got its first public IP address and is reachable',
					},
				],
			},
			{
				displayName: 'Virtual Machine',
				name: 'virtualMachineId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				displayOptions: { show: { event: ['statusChange'] } },
				description: 'Watch one virtual machine only. Leave empty to watch all of them.',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'Any virtual machine',
						typeOptions: { searchListMethod: 'getVirtualMachines', searchable: true },
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. 7c9e6679-7425-40de-944b-e07fc1f90ae7',
					},
				],
			},
		],
	};

	methods = { listSearch: { getVirtualMachines } };

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const event = this.getNodeParameter('event') as string;
		const state = this.getWorkflowStaticData('node') as TriggerState;
		const isManual = this.getMode() === 'manual';

		let vms: IDataObject[];
		const onlyId =
			event === 'statusChange'
				? (this.getNodeParameter('virtualMachineId', '', { extractValue: true }) as string)
				: '';
		if (onlyId) {
			vms = [
				await nodeRingsApiRequest.call(
					this,
					'GET',
					`/v1/virtual-machines/${encodeURIComponent(onlyId)}`,
				),
			];
		} else {
			vms = await nodeRingsApiRequestAllItems.call(this, '/v1/virtual-machines', 'virtualMachines');
		}

		// A manual test run shows the newest virtual machine so the user sees the
		// output format, without touching the stored state.
		if (isManual) {
			const newest = [...vms].sort((a, b) =>
				String(b.createTime).localeCompare(String(a.createTime)),
			)[0];
			return newest ? [[{ json: { event, ...newest } }]] : null;
		}

		const ids = vms.map((vm) => String(vm.id));
		const statusById: Record<string, string> = {};
		const hostnameById: Record<string, string> = {};
		for (const vm of vms) {
			statusById[String(vm.id)] = String(vm.operationStatus ?? '');
			hostnameById[String(vm.id)] = String(vm.hostname ?? '');
		}
		const withIp = vms.filter((vm) => vm.ipv4 || vm.ipv6).map((vm) => String(vm.id));

		const emitted: IDataObject[] = [];
		if (state.primed) {
			if (event === 'newVirtualMachine') {
				const known = new Set(state.knownIds ?? []);
				for (const vm of vms) if (!known.has(String(vm.id))) emitted.push({ event, ...vm });
			} else if (event === 'statusChange') {
				const before = state.statusById ?? {};
				for (const vm of vms) {
					const id = String(vm.id);
					if (id in before && before[id] !== statusById[id]) {
						emitted.push({ event, previousStatus: before[id], ...vm });
					}
				}
				// Virtual machines that disappeared were deleted.
				for (const id of Object.keys(before)) {
					if (!(id in statusById) && !onlyId) {
						emitted.push({
							event,
							id,
							hostname: state.hostnameById?.[id],
							previousStatus: before[id],
							operationStatus: 'OPERATION_STATUS_DELETED',
						});
					}
				}
			} else if (event === 'ipAssigned') {
				const ready = new Set(state.ipReadyIds ?? []);
				for (const vm of vms)
					if (!ready.has(String(vm.id)) && (vm.ipv4 || vm.ipv6)) emitted.push({ event, ...vm });
			}
		}

		state.primed = true;
		state.knownIds = ids;
		state.statusById = statusById;
		state.hostnameById = hostnameById;
		state.ipReadyIds = withIp;

		return emitted.length ? [emitted.map((json) => ({ json }))] : null;
	}
}
