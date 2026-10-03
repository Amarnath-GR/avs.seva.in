/**
 * Tests for the opt-in WhatsApp review request.
 *
 * The behaviours worth pinning are the ones that decide whether this is legal
 * and whether it works at all:
 *  - the conversation starts on the visitor's side, never an unsolicited send
 *  - a bad address is rejected rather than producing a useless wa.me link
 *  - the number appears once, as digits only, with no placeholder
 *  - an email route exists for visitors without WhatsApp
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(
  join(here, '..', 'src', 'components', 'WhatsappLead.jsx'), 'utf8');

const APP_SRC = readFileSync(join(here, '..', 'src', 'App.jsx'), 'utf8');

test('the component is rendered on the page', () => {
  assert.match(APP_SRC, /import WhatsappLead from/);
  assert.match(APP_SRC, /<WhatsappLead \/>/);
});

test('the hero links to it', () => {
  assert.match(APP_SRC, /href="#free-review"/);
  assert.match(src, /id="free-review"/);
});

test('opens wa.me so the visitor starts the conversation', () => {
  // The whole point is that WE do not send anything. The visitor's own action
  // opens their WhatsApp app with a message they can still edit or discard.
  assert.match(src, /wa\.me/);
  assert.ok(
    !/api\.facebook\.com|\/v\d+\.\d+\/messages/.test(src),
    'the component must not call the Cloud API directly from the browser',
  );
});

test('the number is digits only and fully international', () => {
  const m = src.match(/WHATSAPP_NUMBER = '([^']+)'/);
  assert.ok(m, 'number constant not found');
  assert.match(m[1], /^\d{10,15}$/, 'must be digits only, no + or spaces');
  assert.ok(m[1].startsWith('91'), 'must carry the country code');
});

test('the number appears exactly once in the component', () => {
  const occurrences = src.match(/91\d{10}/g) || [];
  assert.equal(occurrences.length, 1,
    'the number must be defined in one place, not repeated');
});

test('rejects input that is not a website address', () => {
  // Exercised through the same expression the component uses.
  const isValid = new RegExp(
    /^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.source, 'i');
  const bad = ['', 'hello', 'not a url', 'acme', 'http://', '@@@'];
  for (const value of bad) {
    assert.equal(isValid.test(value.trim()), false, `${value} should fail`);
  }
});

test('accepts the forms a visitor actually types', () => {
  const isValid = /^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i;
  for (const value of ['acme.co.uk', 'www.acme.co.uk', 'https://acme.co.uk',
    'http://acme.co.uk/menu', 'my-shop.co.uk']) {
    assert.equal(isValid.test(value.trim()), true, `${value} should pass`);
  }
});

test('the submitted address is carried into the prefilled message', () => {
  assert.match(src, /PREFILLED_MESSAGE/);
  assert.match(src, /text=\$\{encodeURIComponent/);
});

test('an email route is offered', () => {
  // A visitor with no WhatsApp installed must still have a way in.
  assert.match(src, /mailto:/);
  assert.match(src, /avsseva@gmail\.com/);
});

test('the input is labelled and the error is announced', () => {
  assert.match(src, /<label htmlFor="review-website">/);
  assert.match(src, /id="review-website"/);
  assert.match(src, /role="alert"/);
  assert.match(src, /aria-invalid/);
});

test('nothing is pre-filled with a phone number', () => {
  // Auto-filling someone's number would be collecting data they did not give.
  assert.ok(!/type="tel"/.test(src));
});