import { describe, it, expect } from 'vitest'
import { randomUUID as uuid } from 'crypto'
import authorize from '../src/handlers/authorize.js'
import { authtoken } from '../src/helpers/api.js';

describe('authorizer works', () => {
  let handler = authorize('test', ['TestPermission']);

  it('should allow valid token and deny invalid token', async () => {
    const handler = authorize('test', ['TestPermission']);

    expect(handler).toBeTypeOf('function');
  });

  it('should return a valid token for a valid account', async () => {
    const account = uuid();

    const token = await handler({
      type: 'TOKEN',
      methodArn: 'arn:aws:execute-api:eu-central-1:864358974821:q8jejjlix5/LATEST/POST/bom/engines',
      authorizationToken: authtoken(account).toString()
    });

    expect(token).toBeTypeOf('object');
    expect(token.policyDocument.Statement).toBeInstanceOf(Array);
    expect(token.policyDocument.Statement).toHaveLength(1);
    expect(token.policyDocument.Statement[0].Effect).toBe('Allow');
    expect(token.policyDocument.Statement[0].Action).toBe('execute-api:Invoke');
    expect(token.context?.AccountId).toBe(account);
  });

  it('should deny access for an invalid token', async () => {
    const token2 = await handler({
      type: 'TOKEN',
      methodArn: 'arn:aws:execute-api:eu-central-1:864358974821:q8jejjlix5/LATEST/POST/bom/engines',
      authorizationToken: 'invalid-token'
    });

    expect(token2).toBeTypeOf('object');
    expect(token2.policyDocument.Statement).toBeInstanceOf(Array);
    expect(token2.policyDocument.Statement).toHaveLength(1);
    expect(token2.policyDocument.Statement[0].Effect).toBe('Deny');
  });
});