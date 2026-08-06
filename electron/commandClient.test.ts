import { describe, expect, it } from 'vitest';
import { createCommandClient } from './commandClient';

describe('createCommandClient', () => {
  it('builds a v1 envelope for the named client with the current epoch', () => {
    const client = createCommandClient('nebula-tray', () => 3);
    const envelope = client.send({ name: 'togglePlayback' });
    expect(envelope.v).toBe(1);
    expect(envelope.clientId).toBe('nebula-tray');
    expect(envelope.epoch).toBe(3);
    expect(envelope.seq).toBe(1);
    expect(envelope.command).toEqual({ name: 'togglePlayback' });
  });

  it('monotonically increments seq per client', () => {
    const client = createCommandClient('nebula-test', () => 0);
    expect(client.send({ name: 'next' }).seq).toBe(1);
    expect(client.send({ name: 'previous' }).seq).toBe(2);
  });

  it('reads the epoch lazily on each send', () => {
    let epoch = 0;
    const client = createCommandClient('nebula-test', () => epoch);
    expect(client.send({ name: 'next' }).epoch).toBe(0);
    epoch = 5;
    expect(client.send({ name: 'next' }).epoch).toBe(5);
  });

  it('keeps seq independent across clients', () => {
    const a = createCommandClient('client-a', () => 0);
    const b = createCommandClient('client-b', () => 0);
    expect(a.send({ name: 'next' }).seq).toBe(1);
    expect(b.send({ name: 'next' }).seq).toBe(1);
  });
});
