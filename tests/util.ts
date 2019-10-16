import { getPackageInfo } from '../src/util';

describe('async getPackageUrl(key, value)', () => {
  it('it should get npm module', async () => {
    expect(await getPackageInfo('@types/node', '12.11.1')).toEqual({
      name: '@types/node',
      url: 'https://registry.npmjs.org/@types/node/-/node-12.11.1.tgz'
    });
  });
});
