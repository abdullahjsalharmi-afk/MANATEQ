import { describe, expect, it } from 'vitest';
import { nextTarget } from '@/features/welcome/next';
import { demoCompanyName, handoffStage, HANDOFF, initialProfile } from '@/features/welcome/profiles';
import { SPEEDS, speedKey } from '@/features/account/SettingsScreen';
import { upcoming, whatsappHref } from '@/features/account/SupportScreen';
import { seedWorld } from '@/state';
import type { Appointment } from '@/domain/types';

describe('welcome: demo profiles', () => {
  it('names each profile’s company as the seed defines it', () => {
    for (const profile of ['prospect', 'tenant'] as const) {
      const seeded = seedWorld(profile, Date.now()).company?.name;
      expect(seeded).toBeTruthy();
      expect(demoCompanyName(profile)).toEqual(seeded);
    }
  });

  it('offers the profile in use, else the established investor', () => {
    expect(initialProfile('prospect', true)).toBe('prospect');
    expect(initialProfile('tenant', true)).toBe('tenant');
    expect(initialProfile('guest', true)).toBe('tenant');
    expect(initialProfile('prospect', false)).toBe('tenant');
  });

  it('ticks identity, then the registration, then opens the profile in about a second', () => {
    expect(handoffStage(0)).toEqual({ identity: false, registry: false, done: false });
    expect(handoffStage(HANDOFF.identity)).toEqual({ identity: true, registry: false, done: false });
    expect(handoffStage(HANDOFF.registry)).toEqual({ identity: true, registry: true, done: false });
    expect(handoffStage(HANDOFF.done).done).toBe(true);
    expect(HANDOFF.done).toBeGreaterThanOrEqual(800);
    expect(HANDOFF.done).toBeLessThanOrEqual(1500);
  });
});

describe('settings: simulation speed', () => {
  it('maps the three options to 0.5, 1 and 4', () => {
    expect(SPEEDS).toEqual({ calm: 0.5, normal: 1, fast: 4 });
  });
  it('describes any speed by its nearest option', () => {
    expect(speedKey(0)).toBe('calm');
    expect(speedKey(0.5)).toBe('calm');
    expect(speedKey(1)).toBe('normal');
    expect(speedKey(4)).toBe('fast');
    expect(speedKey(20)).toBe('fast');
  });
});

describe('support', () => {
  it('turns the published number into a wa.me link', () => {
    expect(whatsappHref('+974 4032 3333')).toBe('https://wa.me/97440323333');
  });
  it('lists booked appointments still ahead, soonest first', () => {
    const topic = { ar: 'موعد', en: 'Appointment' };
    const list: Appointment[] = [
      { id: 'a', at: 300, topic, channel: 'video', status: 'booked' },
      { id: 'b', at: 100, topic, channel: 'phone', status: 'booked' },
      { id: 'c', at: 50, topic, channel: 'phone', status: 'booked' },
      { id: 'd', at: 200, topic, channel: 'in_person', status: 'cancelled' },
    ];
    expect(upcoming(list, 80).map((a) => a.id)).toEqual(['b', 'a']);
  });
});

describe('welcome: where a deep link leads after entering', () => {
  it('keeps an in-app route and refuses anything else', () => {
    expect(nextTarget('/verify?code=NOC-2611-0088')).toBe('/verify?code=NOC-2611-0088');
    expect(nextTarget('/services/A4')).toBe('/services/A4');
    expect(nextTarget(undefined)).toBe('/');
    expect(nextTarget('https://example.com')).toBe('/');
    expect(nextTarget('//example.com')).toBe('/');
    expect(nextTarget('/welcome?next=/x')).toBe('/');
  });
});
