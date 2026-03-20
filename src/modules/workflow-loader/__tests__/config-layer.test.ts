import { ConfigLayer } from '../config-layer';
import type { WorkflowConfig } from '../types';

describe('ConfigLayer', () => {
  const fullConfig: WorkflowConfig = {
    tracker: { type: 'linear', project: 'SYMPHONY' },
    polling: { interval: 60 },
    workspace: { path: '/home/user/workspace' },
    hooks: { 'pre-commit': 'echo before', 'post-commit': ['echo after', 'echo done'] },
    agent: { model: 'claude-3-opus' },
    codex: { version: 2 },
    server: { port: 4000 },
  };

  let layer: ConfigLayer;

  beforeEach(() => {
    layer = new ConfigLayer(fullConfig);
  });

  describe('getTracker()', () => {
    it('should return the tracker config', () => {
      expect(layer.getTracker()).toEqual({ type: 'linear', project: 'SYMPHONY' });
    });

    it('should return undefined when tracker is not set', () => {
      const emptyLayer = new ConfigLayer({});
      expect(emptyLayer.getTracker()).toBeUndefined();
    });
  });

  describe('getPolling()', () => {
    it('should return the polling config', () => {
      expect(layer.getPolling()).toEqual({ interval: 60 });
    });

    it('should return undefined when polling is not set', () => {
      const emptyLayer = new ConfigLayer({});
      expect(emptyLayer.getPolling()).toBeUndefined();
    });
  });

  describe('getWorkspacePath()', () => {
    it('should return the workspace path string', () => {
      expect(layer.getWorkspacePath()).toBe('/home/user/workspace');
    });

    it('should return undefined when workspace is not set', () => {
      const emptyLayer = new ConfigLayer({});
      expect(emptyLayer.getWorkspacePath()).toBeUndefined();
    });

    it('should return undefined when workspace.path is not set', () => {
      const layerWithoutPath = new ConfigLayer({ workspace: {} });
      expect(layerWithoutPath.getWorkspacePath()).toBeUndefined();
    });
  });

  describe('getHooks()', () => {
    it('should return the hooks config', () => {
      expect(layer.getHooks()).toEqual({
        'pre-commit': 'echo before',
        'post-commit': ['echo after', 'echo done'],
      });
    });

    it('should return undefined when hooks are not set', () => {
      const emptyLayer = new ConfigLayer({});
      expect(emptyLayer.getHooks()).toBeUndefined();
    });
  });

  describe('getAgent()', () => {
    it('should return the agent config', () => {
      expect(layer.getAgent()).toEqual({ model: 'claude-3-opus' });
    });

    it('should return undefined when agent is not set', () => {
      const emptyLayer = new ConfigLayer({});
      expect(emptyLayer.getAgent()).toBeUndefined();
    });
  });

  describe('getCodex()', () => {
    it('should return the codex config', () => {
      expect(layer.getCodex()).toEqual({ version: 2 });
    });
  });

  describe('getServer()', () => {
    it('should return the server config', () => {
      expect(layer.getServer()).toEqual({ port: 4000 });
    });

    it('should return undefined when server is not set', () => {
      const emptyLayer = new ConfigLayer({});
      expect(emptyLayer.getServer()).toBeUndefined();
    });
  });

  describe('getServerPort()', () => {
    it('should return the server port number', () => {
      expect(layer.getServerPort()).toBe(4000);
    });

    it('should return undefined when server port is not set', () => {
      const emptyLayer = new ConfigLayer({});
      expect(emptyLayer.getServerPort()).toBeUndefined();
    });
  });

  describe('getRaw()', () => {
    it('should return the full raw config', () => {
      expect(layer.getRaw()).toBe(fullConfig);
    });
  });
});
