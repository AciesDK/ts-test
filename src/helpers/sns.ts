import { SNS } from 'aws-sdk'
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { db } from './db'
import { randomUUID as uuid } from 'crypto'

const testStart = new Date().getTime() - Math.ceil(process.uptime()) * 1000;

export const snsArn = process.env.SNS!;

export const sns = new SNS({ region: 'eu-central-1' });

const snsTable = process.env.SNSTABLE!;

interface IEvent extends DocumentClient.AttributeMap {
  resource: string;
  timestamp: number;
  account: string;
  attributes: {
    [ name: string ]: string;
  };
  event: {
    [ name: string ]: any;
  };
  expiresAt: number;
  identity?: string;
  service: string;
  sha: string;
}

type SatisfyFunction = (event: any) => boolean;

export let service: string | undefined = (process.env.APIHOST || '').split('/').reverse()[0] || undefined;

export async function eventsHandler(account: string, resource: string): Promise<IEvent[]>;
export async function eventsHandler(account: string, resource: string, event?: IAttributeEvent): Promise<IEvent[]>;
export async function eventsHandler(account: string, resource: 'Job', job: string): Promise<IEvent[]>;
export async function eventsHandler(account: string, resource: string, satisfy: SatisfyFunction): Promise<IEvent[]>;
export async function eventsHandler(account: string, satisfy: SatisfyFunction): Promise<IEvent[]>;
export async function eventsHandler(account: string, filter?: string | SatisfyFunction, filter2?: string | SatisfyFunction): Promise<IEvent[]> {
  if (!service) throw Error('Service not set for events');
  
  const query: string[] = ['#account = :account'];
  const filters: string[] = [];
  const names: { [n:string ]: string;} = {
    '#account': 'account'
  }
  const values: { [n:string ]: string | number;} = {
    ':account': account
  };

  if (filter) {
    if (typeof filter === 'string') {
      if (filter.toLowerCase() === 'job') {
        if (typeof filter2 === 'string') {
          const [ jobService, job ] = filter2.split(':');

          if (job) {
            query.push('begins_with(#key, :key)');
            names['#key'] = 'key';
            values[':key'] = jobService + '/Job:' + job + '/';
          }
          else {
            query.push('begins_with(#key, :key)');
            names['#key'] = 'key';
            values[':key'] = jobService + '/Job:';
          }
        }
      }
      else if (typeof filter2 === 'string') {
        query.push('begins_with(#key, :key)');
        names['#key'] = 'key';
        values[':key'] = service + '/' + filter + '/' + filter2 + '/';
      }
      else {
        query.push('begins_with(#key, :key)');
        names['#key'] = 'key';
        values[':key'] = service + '/' + filter + '/';
      }
    }
  }

  filters.push('#timestamp >= :timestamp');
  names['#timestamp'] = 'timestamp';
  values[':timestamp'] = testStart || 0;

  const handler = async (token?: DocumentClient.Key, events: IEvent[] = []): Promise<IEvent[]> => {
    const params = {
      TableName: snsTable,
      KeyConditionExpression: query.join(' AND '),
      FilterExpression: filters.length ? filters.join(' AND ') : undefined,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ExclusiveStartKey: token
    };

    await db
      .query(params)
      .promise()
      .then(async v => {
        if (v.Items) events.push(...v.Items.filter((v: DocumentClient.AttributeMap) => typeof filter === 'function' ? filter(v) : (typeof filter2 === 'function' ? filter2(v) : true)) as IEvent[]);
        if (v.LastEvaluatedKey) await handler(v.LastEvaluatedKey, events);
      })
      .catch(e => {
        throw e;
      });

    return events;
  };

  return await handler();
}

export const events = (() => {
  const t: typeof eventsHandler & {
    service: (v: string) => void;
  } = eventsHandler as any;

  t.service = (v: string) => {
    service = v;
  };

  return t;
})();

interface IBaseAttributes {
  [ name: string ]: string | number | undefined;
  Service: string;
  AccountId?: string;
  CorrelationId?: string;
  Debug?: 'trace' | 'debug';
}

interface IResourceAttributes extends IBaseAttributes {
  Resource: string;
  Event: IAttributeEvent;
}

interface IJobAttributes extends IBaseAttributes {
  Job: string;
}

type IAttributes = IResourceAttributes | IJobAttributes;

type IAttributeEvent = 'Created' | 'Updated' | 'Deleted' | 'Refresh';

const correlationid = uuid();

export function attributes(attributes: IAttributes): SNS.MessageAttributeMap {
  attributes.Debug??='debug';
  attributes.CorrelationId??=correlationid;

  return Object.entries(attributes)
    .reduce((o,[k,v])=>{o[k]={DataType:'String',StringValue:v};return o;},{} as {[n:string]:any;})
}

export async function publish(message: object, service: string, resource: string, event: IAttributeEvent, account: string): Promise<string>;
export async function publish(message: object, attributes: IAttributes, account: string): Promise<string>;
export async function publish(message: object, a: IAttributes | string, b?: string, c?: IAttributeEvent, d?: string): Promise<string> {
  if (typeof a === 'object') {
    a.Debug??='debug';
    a.AccountId??=b!;
    a.CorrelationId??=correlationid;
  }

  return await sns
    .publish({
      TopicArn: snsArn,
      Message: JSON.stringify(message),
      MessageAttributes: attributes(typeof a === 'string' ? { Service: a, Resource: b!, Event: c!, AccountId: d! } : a)
    })
    .promise()
    .then(v => v?.MessageId!)
    .catch((e: Error) => {
      throw e;
    });
}