import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('navigation links to the real contact section', () => {
  const navbar = read('src/components/NavBar.jsx');
  assert.match(navbar, /href="#contact-form"/);
  assert.doesNotMatch(navbar, /href="#contact"/);
});

test('contact form is a real Netlify form with explicit labels', () => {
  const form = read('src/components/ContactForm.jsx');
  assert.match(form, /name="contact"/);
  assert.match(form, /method="POST"/);
  assert.match(form, /data-netlify="true"/);
  assert.match(form, /form-name/);
  assert.match(form, /URLSearchParams/);
  assert.match(form, /fetch\(['"]\/__forms\.html['"]/);
  assert.match(form, /<label/);
});

test('page excludes unverified testimonials', () => {
  const app = read('src/App.jsx');
  assert.doesNotMatch(app, /Testimonials/);
  assert.doesNotMatch(app, /Priya Sharma|Vikram Patel/);
});

test('document has production metadata and accessible branding', () => {
  const html = read('index.html');
  assert.match(html, /<title>AVS Seva Technologies/);
  assert.match(html, /name="description"/);
  assert.match(html, /rel="canonical" href="https:\/\/avsseva\.in\/"/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /property="og:description"/);
  assert.match(html, /property="og:type"/);
  assert.match(html, /rel="icon" type="image\/svg\+xml" href="\/favicon\.svg"/);
  assert.doesNotMatch(html, /vite\.svg/);
});

test('Netlify configuration forces HTTPS and declares build settings', () => {
  const config = read('public/_redirects');
  assert.match(config, /http:\/\/avsseva\.in\/\* https:\/\/avsseva\.in\/:splat 301!/);
  assert.ok(existsSync(new URL('../netlify.toml', import.meta.url)));
  const netlify = read('netlify.toml');
  assert.match(netlify, /command\s*=\s*"npm run build"/);
  assert.match(netlify, /publish\s*=\s*"dist"/);
});

test('public support files include robots and sitemap', () => {
  assert.ok(existsSync(new URL('../public/robots.txt', import.meta.url)));
  assert.ok(existsSync(new URL('../public/sitemap.xml', import.meta.url)));
  const robots = read('public/robots.txt');
  const sitemap = read('public/sitemap.xml');
  assert.match(robots, /Sitemap: https:\/\/avsseva\.in\/sitemap\.xml/);
  assert.match(sitemap, /https:\/\/avsseva\.in\//);
});
