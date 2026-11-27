import type {
	IDataObject,
	IExecuteFunctions,
	IExecuteSingleFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IPollFunctions,
} from 'n8n-workflow';

type Context =
	| IExecuteFunctions
	| IExecuteSingleFunctions
	| IHookFunctions
	| ILoadOptionsFunctions
	| IPollFunctions;

/** Calls the NodeRings API with the node's credential. `path` starts with /v1/. */
export async function nodeRingsApiRequest(
	this: Context,
	method: IHttpRequestMethods,
	path: string,
	qs: IDataObject = {},
	body: IDataObject | undefined = undefined,
): Promise<IDataObject> {
	const credentials = await this.getCredentials('nodeRingsApi');
	const baseUrl = String(credentials.baseUrl || 'https://api.noderings.com').replace(/\/+$/, '');
	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${path}`,
		qs,
		body,
		json: true,
	};
	return (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'nodeRingsApi',
		options,
	)) as IDataObject;
}

/** Reads every page of a list endpoint that takes page and pageSize and returns totalCount. */
export async function nodeRingsApiRequestAllItems(
	this: Context,
	path: string,
	rootProperty: string,
	qs: IDataObject = {},
	pageSize = 100,
): Promise<IDataObject[]> {
	const all: IDataObject[] = [];
	for (let page = 0; page < 1000; page++) {
		const response = await nodeRingsApiRequest.call(this, 'GET', path, { ...qs, page, pageSize });
		const items = (response[rootProperty] as IDataObject[] | undefined) ?? [];
		all.push(...items);
		const total = Number(response.totalCount ?? 0);
		if (items.length < pageSize || all.length >= total) break;
	}
	return all;
}
