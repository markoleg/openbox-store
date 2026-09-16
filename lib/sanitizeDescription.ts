/** Server-side allowlist sanitizer for untrusted seller HTML. Output is inert markup: no scripts, styles, forms, media or tracking. */
import sanitizeHtml from 'sanitize-html';
import type { DescriptionSource } from './capturedListing.ts';

export type SafeDescription = {kind:'html'; html:string; length:number} | {kind:'text'; text:string; length:number} | null;

const options:sanitizeHtml.IOptions={
  allowedTags:['p','br','h1','h2','h3','h4','h5','h6','ul','ol','li','em','strong','b','i','u','s','blockquote','table','thead','tbody','tr','th','td','a','span','div','hr','pre','code'],
  allowedAttributes:{a:['href','target','rel']},
  allowedSchemes:['https'],
  allowedSchemesAppliedToAttributes:['href'],
  allowProtocolRelative:false,
  // Drop the content of these too, not only the tags; the raw value stays in the technical block.
  nonTextTags:['script','style','textarea','option','noscript','template','title','head','iframe','object','embed','svg','math','form','select','button','input','link','meta','img','video','audio','picture','source','canvas'],
  disallowedTagsMode:'discard',
  parser:{lowerCaseTags:true,decodeEntities:true},
  transformTags:{
    // Anything but a plain https link is kept as text; sanitize-html re-checks the scheme afterwards.
    a:(tag,attribs):sanitizeHtml.Tag=>/^\s*https:\/\//i.test(attribs.href ?? '')
      ? {tagName:'a',attribs:{href:attribs.href.trim(),target:'_blank',rel:'noopener noreferrer nofollow'}}
      : {tagName:'span',attribs:{}},
    h1:'h4',h2:'h4',h3:'h4',
  },
};

function plain(value:string):string {
  // Collapse runaway whitespace but keep paragraph breaks for pre-wrap rendering.
  return value.replace(/\r\n?/g,'\n').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}

export function sanitizeDescription(source:DescriptionSource):SafeDescription {
  if(!source)return null;
  if(source.kind==='text') {
    const value=plain(source.value);
    return value ? {kind:'text',text:value,length:value.length} : null;
  }
  const html=sanitizeHtml(source.value,options).replace(/\s*\n\s*/g,'\n').trim();
  const visible=sanitizeHtml(html,{allowedTags:[],allowedAttributes:{}}).replace(/\s+/g,' ').trim();
  if(!visible)return null;
  return {kind:'html',html,length:visible.length};
}
