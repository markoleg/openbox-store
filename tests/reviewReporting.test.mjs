import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateExportPage,integerParameter,durationLabel} from '../lib/reviewReporting.ts';
const manifest={id:'sample',created_at:'now',expires_at:'tomorrow',filters:{},row_count:2,excluded_count:0};
const row=n=>({schemaVersion:1,ordinal:n,assessment:{},features:{},decision:{}});
test('export accepts ordered pages and a verified complete footer boundary',()=>{
  assert.equal(validateExportPage(manifest,0,{manifest,after:1,complete:false,rows:[row(1)]}),1);
  assert.equal(validateExportPage(manifest,1,{manifest,after:2,complete:true,rows:[row(2)]}),2);
  const empty={...manifest,row_count:0};
  assert.equal(validateExportPage(empty,0,{manifest:empty,after:0,complete:true,rows:[]}),0);
});
test('export rejects missing pages, duplicate ordinals and changing manifest',()=>{
  for(const page of [
    {manifest,after:2,complete:true,rows:[row(2)]},
    {manifest,after:1,complete:true,rows:[row(1)]},
    {manifest,after:0,complete:false,rows:[]},
    {manifest,after:2,complete:true,rows:[row(1),row(1)]},
    {manifest:{...manifest,row_count:3},after:1,complete:false,rows:[row(1)]},
  ])assert.throws(()=>validateExportPage(manifest,0,page),/incomplete_export/);
});
test('report cursor and explicit threshold reject unsafe values',()=>{
  for(const value of ['-1','NaN','1.1','1e3','Infinity','9007199254740992',''])assert.throws(()=>integerParameter(value,0,Number.MAX_SAFE_INTEGER));
  assert.equal(integerParameter(null,25,100),25);
  assert.equal(integerParameter('0',25,100),0);
  assert.throws(()=>integerParameter('101',25,100));
});
test('no sample is not a zero-second response',()=>{
  assert.equal(durationLabel(null),'—');assert.equal(durationLabel(-1),'—');assert.equal(durationLabel(0),'0 с');
});
