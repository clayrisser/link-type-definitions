import { getPackageUrl } from '../src/util';

describe('async getPackageUrl(key, value)', () => {
  it('it should get npm module', async () => {
    expect(await getPackageUrl('@types/node', 'latest')).toBe(
      'https://npmjs.org/package/@types/node'
    );
  });
});
