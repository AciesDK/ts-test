import zlib from 'zlib'

export interface IAuthToken {
  type?: 'server' | 'user';
  organization?: string;
  account: string;
  server?: string;
  user?: string;
  permissions?: (string | (new (...args: any[]) => Object))[] | {
    [ name: string ]: (string | (new (...args: any[]) => Object))[];
  };
}

export const factory = (service: string, defaultPermissions: string[] = []) => async (event: { type: 'TOKEN', methodArn: string; authorizationToken: string; }) => {
  const resources = (([arn,stage],methods)=>methods.map(method => [arn,stage,method+'/*'].join('/')))(event.methodArn.split('/', 2),['OPTIONS','HEAD','GET','POST','PATCH','PUT','DELETE']);

  try {
    const token: IAuthToken = {
      ...{
        type: 'server',
        server: '00000000-556d-491a-b809-29939d0259b6',
        user: '00000000-2b99-41ef-aea2-d0826661163e',
        organization: '00000000-773d-4f34-9677-500fdca4ce83',
        permissions: (v => (!v || v == '*' ? defaultPermissions.join(',') : v).split(','))(process.env.PERMISSIONS)
      },
      ...JSON.parse(Buffer.from(event.authorizationToken, 'base64').toString())
    };

    token.permissions = Array.isArray(token.permissions) ? token.permissions.map(v=>service+':'+v) : Object.fromEntries(Object.entries(token.permissions!).map(([k,v])=>[k,v.map(v=>service+':'+v)]));

    if (!token.account || !/^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/.test(token.account)) throw Error('Account not defined');

    const identity = token.type === 'server' ? token.server : token.user;
    const identityV2 = token.type === 'server' ? token.organization + ':' + token.account + ':' + token.server : '::' + token.user;

    const context = {
      Identity: identity,
      IdentityV2: identityV2,
      Version: '1.0',
      AccountId: token.type === 'server' ? token.account : undefined,
      PolicyDocument: zlib.gzipSync(Buffer.from(JSON.stringify({
        id: identity,
        identity: identityV2,
        type: token.type,
        cognitoIds: [],
        accounts: Array.isArray(token.permissions) ? [{id:token.account,permissions:token.permissions}] : Object.entries(token.permissions).map(([k,v])=>({id:k,permissions:v})),
        permissions: []
      }))).toString('base64'),
      DebugEnabled: 'true'
    };

    const result = {
      principalId: identity,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [{
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: resources
        }]
      },
      context: JSON.parse(JSON.stringify(context)) as typeof context
    };

    return result;
  }
  catch(e) {
    return {
      principalId: 'exception' + (new Date()).getTime(),
      policyDocument: {
        Version: '2012-10-17',
        Statement: [{
          Action: 'execute-api:Invoke',
          Effect: 'Deny',
          Resource: resources
        }]
      },
      context: undefined
    };
  }
};

export default factory;