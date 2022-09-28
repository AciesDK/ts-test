import nodetest from 'node:test'

type IRetryOptions = {
  retries: number;
  delay: number;
  sleep: {
    base: number;
    max: number;
  }
}
type IRetryHandler<T> = () => Promise<T>;
type IRetryTester<T> = (data: T) => Promise<void>;
type IRetryBreakout<T> = (data: T) => Promise<boolean>;

type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

export default async function<T extends unknown>(
  handler: IRetryHandler<T>,
  tester: IRetryTester<T>,
  breakout?: IRetryBreakout<T>,
  options: Readonly<DeepPartial<IRetryOptions>> = {},
  test?: Parameters<NonNullable<Parameters<typeof nodetest>[0]>>[0]
) {
  const config: Readonly<IRetryOptions> = Object.freeze({
    ...{
      retries: 10,
      delay: 0,
      sleep: {
        base: 1.13,
        max: 3
      }
    },
    ...options as IRetryOptions
  });

  if (config.delay) await new Promise(r=>setTimeout(r, config.delay));
  
  for(let i=0;i<config.retries;i++) {
    let result!: T;
    
    try {
      result = await handler();
    }
    catch(e) {
      const log = 'test handler failed';

      if (test) test.diagnostic(log);
      else console.debug(log);

      throw e;
    }

    try {
      await tester(result);
      
      break;
    }
    catch(e: unknown) {
      if (e instanceof Error) {
        if (e.message.includes('nonretryable') || (breakout && (await breakout(result))) || (i+1) === config.retries) throw e;

        const sleep = Math.floor(
          Math.min(
            Math.pow(config.sleep.base,i),
            config.sleep.max
          ) * 1000
        );
        const log = 'sleep ' + (i+1) + ' ' + sleep + 'ms (' + new Date().getTime() + ')';

        if (test) test.diagnostic(log);
        else console.debug(log);

        await new Promise(r=>setTimeout(r, sleep));
      }
    }
  }
}