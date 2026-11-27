import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class NodeRingsApi implements ICredentialType {
	name = 'nodeRingsApi';

	displayName = 'NodeRings API';

	icon: Icon = { light: 'file:../icons/noderings.svg', dark: 'file:../icons/noderings.dark.svg' };

	documentationUrl = 'https://github.com/noderings/n8n-nodes-noderings#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'A NodeRings service account token. Create one in the NodeRings console under Organization, Access Control, Service accounts.',
		},
		{
			displayName: 'Organization ID',
			name: 'organizationId',
			type: 'string',
			default: '',
			placeholder: 'e.g. 7c9e6679-7425-40de-944b-e07fc1f90ae7',
			description:
				'Organization to act in, sent as the X-Organization-ID header. Leave empty to use the organization the token belongs to.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.noderings.com',
			description:
				'API base URL without a trailing slash. Keep the default unless NodeRings told you otherwise.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiToken}}',
				'X-Organization-ID': '={{$credentials.organizationId || undefined}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1/organization',
			method: 'GET',
		},
	};
}
