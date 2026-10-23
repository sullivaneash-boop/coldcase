#!/usr/bin/env python3
"""Read-only inventory of Markdown inbox sources. Does not ingest or delete files."""
from pathlib import Path
import argparse,csv,hashlib,json,re
from urllib.parse import urlsplit,urlunsplit,parse_qsl,urlencode

def digest(data):return hashlib.sha256(data).hexdigest()
def main_body(text):
 # These are candidate boundaries only; reviewer must check publisher-specific bodies.
 return text.split('### Share this:')[0].split('### Around the Web')[0].strip()
def primary_url(text):
 m=re.search(r'Cancel reply\]\((/[^)]+)',text)
 if m and 'levifrady.com' in text[:300]:
  u=urlsplit('https://levifrady.com'+m.group(1));return urlunsplit((u.scheme,u.netloc,u.path,'',''))
 return ''
def inventory(root,inbox):
 known={};existing_urls={}
 for table in ['source_files','sources']:
  p=root/'00_ADMIN/data_registers'/f'{table}.csv'
  if p.exists():
   with p.open(newline='') as f:
    for x in csv.DictReader(f):
     if x.get('sha256'):known.setdefault(x['sha256'],set()).add(x['source_id'])
     if table=='sources' and x.get('original_url'):existing_urls.setdefault(x['original_url'],set()).add(x['source_id'])
 prior={}
 for m in (root/'00_ADMIN/ingestion_batches').glob('BATCH-MD-*/manifest.json'):
  for x in json.loads(m.read_text()).get('files',[]):
   if x.get('sha256') and x.get('source_id'):known.setdefault(x['sha256'],set()).add(x['source_id'])
   if x.get('original_url') and x.get('article_body_sha256'):prior[(x['original_url'],x['article_body_sha256'])]=x['source_id']
 rows=[];seen={}
 for p in sorted(inbox.glob('*.md')):
  data=p.read_bytes();text=data.decode('utf-8-sig');h=digest(data);url=primary_url(text);bodyhash=digest(main_body(text).encode());same=prior.get((url,bodyhash)) if url else ''
  hit=seen.get((url,bodyhash)) if url else None
  existing=sorted(known.get(h,[]));status='EXACT_DUPLICATE_SKIP' if existing else 'SAME_ARTICLE_CAPTURE_SKIP_EXTRACTION' if same or hit else 'EXISTING_URL_CHANGED_BODY_REVIEW' if url in existing_urls else 'NEW_REVIEW_REQUIRED'
  rows.append(dict(filename=p.name,input_path=str(p),bytes=len(data),sha256=h,original_url=url,article_body_sha256=bodyhash,status=status,existing_source_ids=existing or ([same] if same else sorted(existing_urls.get(url,[]))),same_article_as=hit or '',title=next((s.lstrip('#* ').strip('* ') for s in text.splitlines() if s.startswith('#')),'')))
  if url:seen[(url,bodyhash)]=str(p)
 return rows
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--archive',type=Path,default=Path(__file__).resolve().parents[2]);p.add_argument('--inbox',type=Path);p.add_argument('--dry-run',action='store_true',help='Read-only is always enforced; option included for clarity.');a=p.parse_args();print(json.dumps(inventory(a.archive,a.inbox or a.archive/'_INGEST/MARKDOWN'),indent=2))
