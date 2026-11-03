import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { allowed, normalize } from '../src/normalize.mjs';
const sources=JSON.parse(await readFile(new URL('../config/sources.json',import.meta.url)));
async function evidence(name) {
  const raw=await readFile(new URL(`../evidence/${name}.txt`,import.meta.url),'utf8');
  return JSON.parse(raw.split('\n')[0].replace(/^Result: /,''));
}
test('host approval rejects spoofing, credentials, ports and third parties',()=>{
  for(const url of ['https://bpsc.teletalk.com.bd.evil.com/','https://evil.com/?bpsc.teletalk.com.bd','http://bpsc.teletalk.com.bd/','https://user@bpsc.teletalk.com.bd/','https://bpsc.teletalk.com.bd:8080/','https://bdjobs.com/']) assert.equal(allowed(url,sources[0].hosts),false);
});
test('observed BPSC list yields two circulars, no invented eligibility',async()=>{
  const records=normalize(await evidence('bpsc-noncadre'),sources[0]);
  assert.equal(records.length,2);
  assert.match(records[1].document_url,/ad_202608.pdf$/);
  assert.equal(records[0].requirements,null);
  assert.equal(records[0].publication_status,'needs_review');
});
test('observed selected job is extracted independently from sibling job cards',async()=>{
  const snapshot=await evidence('teletalk-dgms');
  const [job]=normalize(snapshot,sources[1]);
  assert.equal(job.title,'Draftsman');
  assert.match(job.organization,/DGMS/);
  assert.equal(job.source_job_id,'15126');
  assert.equal(job.application_end.raw,'2026-11-21 5:00 PM');
  assert.equal(job.application_fee,null); // generic no-fee disclaimer is not circular evidence
  assert.equal(job.application_links[0].url,'http://dgms.teletalk.com.bd/');
  assert.equal(job.application_links[0].verified,false);
  assert.equal(normalize(snapshot,sources[1])[0].id,job.id);
});
test('changed layout and non-detail pages fail visibly',async()=>{
  const snapshot=await evidence('teletalk-dgms');
  assert.throws(()=>normalize({...snapshot,text:'maintenance'},sources[1]),/pattern changed/);
  assert.throws(()=>normalize({...snapshot,url:sources[1].url},sources[1]),/Missing jobId/);
});
