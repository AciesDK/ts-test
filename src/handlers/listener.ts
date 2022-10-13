import * as aws from 'aws-sdk'
import { SNSEvent } from 'aws-lambda'

const db = new aws.DynamoDB.DocumentClient();
const sns = new aws.SNS();

type IEventType = 'Created' | 'Updated' | 'Deleted' | 'Refresh';
type IEventAttributes = { [ name: string ]: string | number; };
type IEventGenerator = <T extends {}>(service: string, resource: string, event: IEventType, model: T, attributes: IEventAttributes, accountId: string) => ISNSEvent[];

interface ISNSEvent<T extends {} = any> {
  service: string;
  resource: string;
  event: IEventType;
  delay?: number;
  model: T;
  attributes?: IEventAttributes;
}

export const factory = (events: IEventGenerator) => async (event: SNSEvent) => {
  console.log(JSON.stringify(event));

  const model = (v => {
    try {
      return JSON.parse(v);
    }
    catch(e) {
      console.error(e);
      return undefined;
    }
  })(event.Records[0].Sns.Message);
  
  console.log('model', JSON.stringify(model));

  const attributes = Object
    .entries(event.Records[0].Sns.MessageAttributes)
    .reduce((o,[k,v])=>{o[k]=v.Type=='Number'?Number(v.Value):String(v.Value);return o;},{} as IEventAttributes);

  console.log('attributes', JSON.stringify(attributes));

  const service = String(attributes.Service || 'noname');
  const resource = String(attributes.Resource || 'Job:' + attributes.Job);
  const accountId = String(attributes.AccountId);
  const identityId = String(attributes.IdentityId || attributes.UserId || "") || null;
  const t = (event.Records[0].Sns.Timestamp ? new Date(event.Records[0].Sns.Timestamp) : new Date()).getTime() + "." + Math.random().toString().concat('0'.repeat(4)).substring(2,6);

  await db
    .put({
      TableName: process.env.TABLE!,
      Item: {
        account: accountId,
        key: service + '/' + resource + (attributes.Event ? '/' + attributes.Event : ''),
        timestamp: t,
        event: model,
        attributes: attributes,
        identity: identityId,
        service: service,
        sha: process.env.VERSION,
        expiresAt: t + (60*60*24*30)
      }
    })
    .promise()
    .then(v => console.debug(v))
    .catch(e => {throw e;});

  // mock sns responses from other service listeners
  const promises: Promise<any>[] = [];

  events(service, resource, attributes.Event as IEventType, model, attributes, accountId)
    .forEach(v => {
      promises
        .push(new Promise(async (res,rej) => {
          try {
            if (v.delay) await new Promise(r => setTimeout(r, v.delay));

            res(
              await sns
                .publish({
                  TopicArn: process.env.SNS,
                  Message: JSON.stringify(v.model),
                  MessageAttributes: Object.entries({
                    ...attributes,
                    ...(v.attributes || {}),
                    ...{
                      Service: v.service,
                      Resource: v.resource,
                      Event: v.event
                    }
                  }).reduce((o,[k,v])=>{o[k]={DataType:'String',StringValue:v};return o;},{} as aws.SNS.Types.MessageAttributeMap)
                })
                .promise()
                .then(console.log)
                .catch(e=>{throw e;})
            );
          }
          catch(e) {
            rej(e);
          }
        }));
    });

  await Promise
    .all(promises)
    .then(console.log)
    .catch(e => {throw e;});
};

export default factory;