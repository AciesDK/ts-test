import { DynamoDB } from 'aws-sdk'
import http from 'https'

export const modelStore = process.env.MODELSTORE!;

const agent = new http.Agent({
  keepAlive: true
});
  
export const db = new DynamoDB.DocumentClient({ region: 'eu-central-1', httpOptions: { agent: agent } });

export default db;