import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import http from 'https'

export const modelStore = process.env.MODELSTORE!;

const agent = new http.Agent({
  keepAlive: true
});

import { NodeHttpHandler } from "@aws-sdk/node-http-handler";

export const db = DynamoDBDocument.from(
  new DynamoDB({
    region: 'eu-central-1',
    requestHandler: new NodeHttpHandler({ httpsAgent: agent })
  })
);

export default db;