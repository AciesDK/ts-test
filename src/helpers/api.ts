import axios, { AxiosInstance } from 'axios'
import { IAuthToken } from '../handlers/authorize';

export const host = process.env.APIHOST;

if (host && process.env.APIHOST) process.env.API = host.replace(/^https?:\/\//, '').replace(/\/[^/]+$/, '');

process.env.SERVICE = host?.split('/').reverse()[0];

interface IConfig extends IAuthToken {
  
}

const uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/;

class AuthToken {
  constructor(public config: IConfig) {}

  toString(): string {
    return Buffer.from(JSON.stringify(this.config)).toString('base64');
  }
}

export const authtoken = (account: string, config: Partial<IConfig> & { account?: undefined } = {}): AuthToken => {
  if (config.type && !['server','user'].includes(config.type)) throw Error('Type not valid');
  if (!uuidRegex.test(account)) throw Error('Account not valid uuid');
  if (config.organization && !uuidRegex.test(config.organization)) throw Error('Organization not valid uuid');
  if (config.server && !uuidRegex.test(config.server)) throw Error('Server not valid uuid');
  if (config.user && !uuidRegex.test(config.user)) throw Error('User not valid uuid');

  if (config.permissions) {
    if (Array.isArray(config.permissions)) config.permissions = { [ account ]: config.permissions };
    
    for(const [ account, permissions ] of Object.entries(config.permissions)) {
      config.permissions[account] = permissions.map(v => typeof v === 'string' ? v : v.name);

      for(const v of (config.permissions[account] as string[])) {
        if (!/^[a-zA-Z]+$/.test(v)) throw Error('Permission ' + v + ' for ' + account + ' is invalid');
      }
    }
  }

  if (config.user) config.type = 'user';

  const authtoken = new AuthToken({
    ...config, 
    ...{account}
  })

  return authtoken;
}

function factoryHandler(account?: string, cached?: boolean): AxiosInstance;
function factoryHandler(token?: AuthToken, cached?: boolean): AxiosInstance;
function factoryHandler(tokenOrAccount?: AuthToken | string, cached = true): AxiosInstance {
  const api = axios.create({
    baseURL: host,
    validateStatus: () => true,
    timeout: 10000
  });

  api.defaults.headers.common['User-Agent'] = 'AciesCore Integration Test';
  api.defaults.headers.common['x-debug'] = 'debug';

  if (!cached) {
    api.defaults.headers.common['Cache-Control'] = 'no-cache, max-age=0';
  }
  
  if (tokenOrAccount) {
    if (tokenOrAccount instanceof AuthToken) {
      if (tokenOrAccount.config.type === 'user') {
        api.defaults.headers.common['x-account-id'] = tokenOrAccount.config.account;
      }
    }
    else {
      tokenOrAccount = authtoken(tokenOrAccount);
    }

    api.defaults.headers.common.Authorization = tokenOrAccount.toString();
  }

  return api;
}

export const factory = (() => {
  const f: typeof factoryHandler & {
    host: typeof host;
    token: typeof authtoken;
  } = factoryHandler as any;

  f.host = host;
  f.token = authtoken;

  return f;
})();

export default factory;