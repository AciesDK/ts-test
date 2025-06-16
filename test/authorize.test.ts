import { expect } from 'chai'
import test from 'node:test'
import { randomUUID as uuid } from 'crypto'
import authorize from '../src/handlers/authorize.js'
import { authtoken } from '../src/helpers/api.js';

test('authorizer works', async t => {

  const handler = authorize('test', ['TestPermission']);

  expect(handler).to.be.an('function');

  const account = uuid();

  const token = await handler({
    type: 'TOKEN',
    methodArn: 'arn:aws:execute-api:eu-central-1:864358974821:q8jejjlix5/LATEST/POST/bom/engines',
    authorizationToken: authtoken(account).toString()
  });

  expect(token).to.be.an('object');
  expect(token.policyDocument.Statement).to.be.an('array').with.lengthOf(1);
  expect(token.policyDocument.Statement[0].Effect).to.eq('Allow');
  expect(token.policyDocument.Statement[0].Action).to.eq('execute-api:Invoke');
  expect(token.context?.AccountId).to.eq(account);

  const token2 = await handler({
    type: 'TOKEN',
    methodArn: 'arn:aws:execute-api:eu-central-1:864358974821:q8jejjlix5/LATEST/POST/bom/engines',
    authorizationToken: 'invalid-token'
  });

  expect(token2).to.be.an('object');
  expect(token2.policyDocument.Statement).to.be.an('array').with.lengthOf(1);
  expect(token2.policyDocument.Statement[0].Effect).to.eq('Deny');

});