import assert from 'node:assert/strict';
import { test, after, afterEach } from 'node:test';
import { createRequire } from 'node:module';
import Module from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { unzipSync, unzlibSync } from 'fflate';
import { decodeQrPixels, eventCodeFromQr, readQrFile } from '../src/utils/qr.js';
import { downloadPhoto, downloadPhotos, photoFilename } from '../src/utils/downloads.js';

const require = createRequire(import.meta.url);
const frontend = fileURLToPath(new URL('..', import.meta.url));
const code = require('esbuild').buildSync({ stdin: { contents: `export { default as GalleryModal } from './src/components/guest/GalleryModal.jsx'; export { default as PhotoCollection } from './src/components/common/PhotoCollection.jsx'; export { default as QRScannerPanel } from './src/components/guest/QRScannerPanel.jsx';`, resolveDir: frontend, loader: 'jsx' }, bundle: true, format: 'cjs', packages: 'external', jsx: 'automatic', write: false }).outputFiles[0].text;
const filename = path.join(frontend, 'tests', 'ui-bundle.cjs');
const bundled = new Module(filename);
bundled.filename = filename;
bundled.paths = Module._nodeModulePaths(path.dirname(filename));
bundled._compile(code, filename);
const { GalleryModal, PhotoCollection, QRScannerPanel } = bundled.exports;
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: 'http://127.0.0.1:5173', pretendToBeVisual: true });
globalThis.window = dom.window; globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;
let savedBlob;
let savedFilename;
let clicks;
const realFetch = globalThis.fetch;
const realCreate = URL.createObjectURL;
const realRevoke = URL.revokeObjectURL;
function resetDownloadMocks() {
  clicks = 0; savedBlob = null; savedFilename = null;
  URL.createObjectURL = (blob) => { savedBlob = blob; return 'blob:photo-download'; };
  URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = function () { clicks++; savedFilename = this.download; };
}
resetDownloadMocks();
async function render(component) { root = createRoot(document.getElementById('app')); await act(async () => { root.render(component); }); }
afterEach(async () => { if (root) { await act(async () => root.unmount()); root = null; } document.body.style.overflow = ''; document.getElementById('app').innerHTML = ''; globalThis.fetch = realFetch; resetDownloadMocks(); });
const button = (text) => [...document.querySelectorAll('button')].find((node) => node.textContent.includes(text));

const fixturePath = new URL('./event-qr.json', import.meta.url);
test('real QR pixels decode an event URL and manual codes work', () => {
  const { data, width, height } = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const decoded = decodeQrPixels(new Uint8ClampedArray(unzlibSync(Buffer.from(data, 'base64'))), width, height);
  assert.equal(eventCodeFromQr(decoded), 'WED-USTR');
  assert.equal(eventCodeFromQr('wed-uxti'), 'WED-UXTI');
  assert.equal(eventCodeFromQr('https://example.com/event/WED-USTR?from=invitation'), 'WED-USTR');
});
test('unrelated or malicious QR content is rejected rather than followed', () => {
  for (const value of ['javascript:alert(1)', 'https://example.com/login', '<script>bad</script>', 'random text']) assert.throws(() => eventCodeFromQr(value));
});
test('single-photo download saves a blob with a filename instead of opening a new tab', async () => {
  globalThis.fetch = async () => new Response(new Uint8Array([1,2,3]), { headers: { 'Content-Type': 'image/jpeg' } });
  await downloadPhoto({ id: 5, image: 'http://localhost:8000/media/photo.jpg', filename: 'wedding.jpg' });
  assert.equal(clicks, 1); assert.equal(savedFilename, 'wedding.jpg'); assert.equal(savedBlob.size, 3);
  assert.equal(document.querySelector('a[download]'), null);
});
test('bulk ZIP retains every photo even when filenames are identical', async () => {
  globalThis.fetch = async (url) => new Response(new Uint8Array(url.endsWith('/1') ? [1,2] : [3,4]), { headers: { 'Content-Type': 'image/jpeg' } });
  const progress = [];
  await downloadPhotos([{image:'http://localhost/1',filename:'same.jpg'}, {image:'http://localhost/2',filename:'same.jpg'}], 'my-photos.zip', (done,total) => progress.push([done,total]));
  assert.equal(savedFilename, 'my-photos.zip');
  const files = unzipSync(new Uint8Array(await savedBlob.arrayBuffer()));
  assert.deepEqual(Object.keys(files), ['001-same.jpg','002-same.jpg']);
  assert.deepEqual([...files['001-same.jpg']], [1,2]);
  assert.deepEqual([...files['002-same.jpg']], [3,4]);
  assert.deepEqual(progress, [[1,2],[2,2]]);
});
test('failed photo response produces an error and never saves an HTML page as a photo', async () => {
  globalThis.fetch = async () => new Response('Not found', {status:404});
  await assert.rejects(downloadPhoto({image:'http://localhost/missing',filename:'missing.jpg'}));
  assert.equal(clicks, 0);
});
test('download filenames cannot contain path traversal separators', () => {
  assert.equal(photoFilename({filename:'../../bad\\name.jpg'}).includes('/'), false);
});
test('preview is rendered above the page, locks background scroll, and closes with Escape', async () => {
  let closed = false;
  await render(React.createElement(GalleryModal, {item:{image:'/photo.jpg',title:'Full photo'},onClose:()=>{closed=true;}}));
  const dialog = document.querySelector('[role="dialog"]');
  assert.ok(dialog); assert.equal(document.getElementById('app').contains(dialog), false);
  assert.equal(document.body.style.overflow, 'hidden');
  assert.equal(document.documentElement.style.overflow, 'hidden');
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  assert.ok(dialog.querySelector('img'));
  assert.equal(dialog.querySelectorAll('a[target="_blank"]').length, 0);
  await act(async () => document.dispatchEvent(new window.KeyboardEvent('keydown', {key:'Escape',bubbles:true})));
  assert.equal(closed, true);
  await act(async () => root.unmount()); root=null;
  assert.equal(document.body.style.overflow, '');
  assert.equal(document.documentElement.style.overflow, '');
});
test('photo gallery starts compact, can show all, and supports paging and selection', async () => {
  const photos = Array.from({length:25},(_,index)=>({id:index+1,image:`/photo-${index}.jpg`,title:`Photo ${index+1}`,filename:`photo-${index}.jpg`}));
  await render(React.createElement(PhotoCollection,{photos,title:'Event photos'}));
  assert.equal(document.querySelectorAll('article').length,12);
  await act(async () => button('Next').click());
  assert.match(document.body.textContent,/Page 2 of 3/);
  await act(async () => button('View all 25').click());
  assert.equal(document.querySelectorAll('article').length,25);
  const checkbox=document.querySelector('input[aria-label="Select Photo 1"]');
  await act(async () => checkbox.click());
  assert.ok(button('Download selected (1)'));
  await act(async () => button('Show 12 per page').click());
  assert.equal(document.querySelectorAll('article').length,12);
});
test('QR panel offers image upload and camera scan without a demo scan action', async () => {
  await render(React.createElement(QRScannerPanel,{active:false,onScan:()=>{},onToggle:()=>{}}));
  assert.ok(button('Upload QR image')); assert.ok(button('Scan with camera'));
  assert.ok(document.querySelector('input[type="file"][accept="image/*"]'));
  assert.doesNotMatch(document.body.textContent,/demo|staged|integration/i);
});

after(() => { dom.window.close(); URL.createObjectURL=realCreate; URL.revokeObjectURL=realRevoke; });

test('QR camera permission errors show a usable upload alternative', async () => {
  Object.defineProperty(navigator, 'mediaDevices', {configurable:true,value:{getUserMedia:async()=>{ const error=new Error('Denied'); error.name='NotAllowedError'; throw error; }}});
  await render(React.createElement(QRScannerPanel,{active:true,onScan:()=>{},onToggle:()=>{}}));
  assert.match(document.querySelector('[role="alert"]').textContent,/permission was denied/i);
  assert.ok(button('Upload QR image'));
});

test('QR camera reads an actual event code and stops its stream after detection', async () => {
  const fixture=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
  const pixels=new Uint8ClampedArray(unzlibSync(Buffer.from(fixture.data,'base64')));
  const oldContext=window.HTMLCanvasElement.prototype.getContext;
  const oldPlay=window.HTMLMediaElement.prototype.play;
  let stopped=0,found='';
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>({getTracks:()=>[{stop:()=>stopped++}]})}});
  window.HTMLCanvasElement.prototype.getContext=()=>({drawImage:()=>{},getImageData:()=>({data:pixels,width:fixture.width,height:fixture.height})});
  window.HTMLMediaElement.prototype.play=async()=>{};
  Object.defineProperty(window.HTMLVideoElement.prototype,'videoWidth',{configurable:true,get:()=>fixture.width});
  Object.defineProperty(window.HTMLVideoElement.prototype,'videoHeight',{configurable:true,get:()=>fixture.height});
  Object.defineProperty(window.HTMLVideoElement.prototype,'readyState',{configurable:true,get:()=>4});
  try {
    await render(React.createElement(QRScannerPanel,{active:true,onScan:(code)=>{found=code;},onToggle:()=>{}}));
    assert.equal(found,'WED-USTR'); assert.ok(stopped>=1);
  } finally { window.HTMLCanvasElement.prototype.getContext=oldContext; window.HTMLMediaElement.prototype.play=oldPlay; }
});


test('QR image upload decodes a saved event QR and rejects non-image files', async () => {
  const fixture=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
  const pixels=new Uint8ClampedArray(unzlibSync(Buffer.from(fixture.data,'base64')));
  const oldImage=globalThis.Image;
  const oldContext=window.HTMLCanvasElement.prototype.getContext;
  globalThis.Image=class { naturalWidth=fixture.width; naturalHeight=fixture.height; async decode() {} };
  window.HTMLCanvasElement.prototype.getContext=()=>({drawImage:()=>{},getImageData:()=>({data:pixels,width:fixture.width,height:fixture.height})});
  try {
    assert.equal(await readQrFile({type:'image/png',size:1024}),'WED-USTR');
    await assert.rejects(readQrFile({type:'text/plain',size:2}),/Choose an image/);
  } finally { globalThis.Image=oldImage; window.HTMLCanvasElement.prototype.getContext=oldContext; }
});
