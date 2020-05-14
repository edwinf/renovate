import * as httpMock from '../../../../test/httpMock';
import { getName, mocked } from '../../../../test/util';
import * as globalCache from '../../../util/cache/global';
import * as runCache from '../../../util/cache/run';
import * as _hostRules from '../../../util/host-rules';
import * as github from '.';

jest.mock('../../../util/host-rules');

const hostRules = mocked(_hostRules);

const basePath = '/repos/some/repo/contents';

describe(getName(__filename), () => {
  beforeEach(() => {
    httpMock.setup();
    runCache.clear();
    hostRules.find.mockReturnValue({ token: 'abc' });
    return globalCache.rmAll();
  });

  afterEach(() => httpMock.reset());

  describe('fetchJSONFile()', () => {
    it('returns JSON', async () => {
      httpMock
        .scope(github.Endpoint)
        .get(`${basePath}/some-filename.json`)
        .reply(200, {
          content: Buffer.from('{"from":"api"}').toString('base64'),
        });

      const res = await github.fetchJSONFile(
        'some/repo',
        'some-filename.json',
        'https://api.github.com/'
      );
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getPreset()', () => {
    it('tries default then renovate', async () => {
      httpMock
        .scope(github.Endpoint)
        .get(`${basePath}/default.json`)
        .reply(500, {})
        .get(`${basePath}/renovate.json`)
        .reply(500, {});

      await expect(
        github.getPreset({ packageName: 'some/repo' })
      ).rejects.toThrow();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('throws if no content', async () => {
      httpMock
        .scope(github.Endpoint)
        .get(`${basePath}/default.json`)
        .reply(200, {});

      await expect(
        github.getPreset({ packageName: 'some/repo' })
      ).rejects.toThrow('invalid preset JSON');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('throws if fails to parse', async () => {
      httpMock
        .scope(github.Endpoint)
        .get(`${basePath}/default.json`)
        .reply(200, {
          content: Buffer.from('not json').toString('base64'),
        });

      await expect(
        github.getPreset({ packageName: 'some/repo' })
      ).rejects.toThrow('invalid preset JSON');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('should return default.json', async () => {
      httpMock
        .scope(github.Endpoint)
        .get(`${basePath}/default.json`)
        .reply(200, {
          content: Buffer.from('{"foo":"bar"}').toString('base64'),
        });

      const content = await github.getPreset({ packageName: 'some/repo' });
      expect(content).toEqual({ foo: 'bar' });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('should query preset within the file', async () => {
      httpMock
        .scope(github.Endpoint)
        .get(`${basePath}/somefile.json`)
        .reply(200, {
          content: Buffer.from('{"somename":{"foo":"bar"}}').toString('base64'),
        });
      const content = await github.getPreset({
        packageName: 'some/repo',
        presetName: 'somefile/somename',
      });
      expect(content).toEqual({ foo: 'bar' });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('should query subpreset', async () => {
      httpMock
        .scope(github.Endpoint)
        .get(`${basePath}/somefile.json`)
        .reply(200, {
          content: Buffer.from(
            '{"somename":{"somesubname":{"foo":"bar"}}}'
          ).toString('base64'),
        });

      const content = await github.getPreset({
        packageName: 'some/repo',
        presetName: 'somefile/somename/somesubname',
      });
      expect(content).toEqual({ foo: 'bar' });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('should return custom.json', async () => {
      httpMock
        .scope(github.Endpoint)
        .get(`${basePath}/custom.json`)
        .reply(200, {
          content: Buffer.from('{"foo":"bar"}').toString('base64'),
        });

      try {
        global.appMode = true;
        const content = await github.getPreset({
          packageName: 'some/repo',
          presetName: 'custom',
        });
        expect(content).toEqual({ foo: 'bar' });
      } finally {
        delete global.appMode;
      }
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getPresetFromEndpoint()', () => {
    it('uses default endpoint', async () => {
      httpMock
        .scope(github.Endpoint)
        .get(`${basePath}/default.json`)
        .reply(200, {
          content: Buffer.from('{"from":"api"}').toString('base64'),
        });
      expect(
        await github.getPresetFromEndpoint('some/repo', 'default')
      ).toEqual({ from: 'api' });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('uses custom endpoint', async () => {
      httpMock
        .scope('https://api.github.example.org')
        .get(`${basePath}/default.json`)
        .reply(200, {
          content: Buffer.from('{"from":"api"}').toString('base64'),
        });
      expect(
        await github
          .getPresetFromEndpoint(
            'some/repo',
            'default',
            'https://api.github.example.org'
          )
          .catch(() => ({ from: 'api' }))
      ).toEqual({ from: 'api' });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
