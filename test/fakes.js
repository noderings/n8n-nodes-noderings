// Minimal stand-ins for the n8n function contexts the node code uses.
'use strict';

function context({ params = {}, pages = [], mode = 'trigger', staticData = {} } = {}) {
	const calls = [];
	return {
		calls,
		staticData,
		getNodeParameter(name, fallback, options) {
			if (!(name in params)) return fallback;
			const v = params[name];
			if (options && options.extractValue && v && typeof v === 'object' && 'value' in v) return v.value;
			return v;
		},
		getMode: () => mode,
		getWorkflowStaticData: () => staticData,
		getCredentials: async () => ({ apiToken: 't', organizationId: '', baseUrl: 'https://api.example.test/' }),
		helpers: {
			async httpRequestWithAuthentication(credentialType, options) {
				calls.push({ credentialType, ...options });
				const next = typeof pages === 'function' ? pages(options) : pages.shift();
				if (next instanceof Error) throw next;
				return next;
			},
		},
	};
}

module.exports = { context };
