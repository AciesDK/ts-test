import { DynamoDB } from 'aws-sdk'
import http from 'https'
import { config as dotenv } from 'dotenv'

dotenv({
  override: true
});

export const modelStore = process.env.MODELSTORE!;

const agent = new http.Agent({
  keepAlive: true
});
  
const db = new DynamoDB.DocumentClient({ region: 'eu-central-1', httpOptions: { agent: agent } });

export default db;