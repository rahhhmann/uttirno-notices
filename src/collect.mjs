import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { allowed, hash, normalize } from './normalize.mjs';

// Read-only acquisition. No application forms, credentials or payment operations.
const sources = JSON.parse(await readFile(new URL('../config/sources.json', import.meta.url)));
const { chromium } = await import('playwright');
const browser = await chromium.launch({ headless: true });
const root = resolve('data');
await mkdir(root, {recursive:true});
let failed = false;
try {
  for (const source of sources.filter(s => s.enabled)) {
    const page = await browser.newPage({ userAgent: 'UttirnoNoticeResearch/0.1' });
    // Block all third-party requests, including ads and unapproved redirects.
    await page.route('**/*', route => allowed(route.request().url(), source.hosts) && route.request().method() === 'GET'
      ? route.continue() : route.abort());
    const run = { source_id:source.id, started_at:new Date().toISOString(), snapshots:0, records:0, errors:[], truncated:false };
    const records = [];
    const dir = resolve(root, source.id, run.started_at.replace(/[:.]/g,'-'));
    await mkdir(dir,{recursive:true});
    const capture = async () => {
      if (!allowed(page.url(), source.hosts)) throw new Error('Unapproved final URL');
      const snapshot = {
        url:page.url(), captured_at:new Date().toISOString(),
        text:await page.locator('body').innerText(),
        links:await page.locator('a[href]').evaluateAll(xs => xs.map(a=>({text:a.textContent.trim(),url:a.href}))),
      };
      await writeFile(resolve(dir, `${hash(snapshot.url)}.json`), JSON.stringify(snapshot,null,2));
      run.snapshots++;
      return snapshot;
    };
    const visit = async (url, selector) => {
      if (!allowed(url,source.hosts)) throw new Error('Unapproved URL');
      const response = await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
      if (!response?.ok()) throw new Error(`HTTP ${response?.status()}`);
      await page.locator(selector).first().waitFor({timeout:20000});
    };
    try {
      await visit(source.url,source.readySelector);
      if (source.adapter === 'circular-links') records.push(...normalize(await capture(),source));
      else {
        const urls = new Set();
        const seenPages = new Set();
        for (let n=0;n<100;n++) {
          const snap = await capture();
          const links = snap.links.filter(a=>allowed(a.url,source.hosts) && /\/jobs\/government\/\d+\?jobId=\d+/.test(a.url));
          if (!links.length) throw new Error('No detail links: list pattern changed');
          const signature = hash(JSON.stringify(links));
          if (seenPages.has(signature)) throw new Error('Pagination repeated');
          seenPages.add(signature);
          links.forEach(a=>urls.add(a.url));
          const next = page.getByRole('button',{name:'Next page',exact:true});
          if (!(await next.count()) || await next.isDisabled()) break;
          if(n===99) {run.truncated=true;break;}
          const before = links[0].url;
          await next.click();
          await page.waitForFunction(old => !Array.from(document.querySelectorAll('a[href*="jobId="]')).some(a=>a.href===old),before,{timeout:20000});
          await page.waitForTimeout(2000);
        }
        for (const url of urls) {
          try {
            await page.waitForTimeout(2000);
            await visit(url,'text=Application Start Date');
            records.push(...normalize(await capture(),source));
          } catch(e) {run.errors.push({url,error:e.message});}
        }
      }
    } catch(e) {run.errors.push({url:page.url(),error:e.message});}
    finally {await page.close();}
    run.records=records.length;
    run.completed_at=new Date().toISOString();
    run.status=run.errors.length || run.truncated || !run.records ? 'incomplete' : 'captured_needs_review';
    failed ||= run.status==='incomplete';
    await writeFile(resolve(dir,'records.json'),JSON.stringify(records,null,2));
    await writeFile(resolve(dir,'run.json'),JSON.stringify(run,null,2));
    // Promote only successful acquisitions. Publication still requires review.
    if(run.status==='captured_needs_review') {
      const temp=resolve(root,`${source.id}.tmp`);
      await writeFile(temp,JSON.stringify({run,records},null,2));
      await rename(temp,resolve(root,`${source.id}.json`));
    }
    console.log(JSON.stringify(run));
  }
} finally {await browser.close();}
if(failed) process.exitCode=1;
