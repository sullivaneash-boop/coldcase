#!/usr/bin/env python3
"""Read-only by default. Copy/extract only with --execute; never alters inbox files."""
import argparse,csv,hashlib,json,os,re,shutil,subprocess,sys,uuid
from pathlib import Path
from datetime import datetime,timezone
from zoneinfo import ZoneInfo
TERMS=['Levi Frady','Levi','Frady','Levi Dillon Frady','Frady family','Marilyn','Laci','Lacey','Milton Frady','Dawson Forest','Little Mill Road','Dawson County','missing boy','murder','homicide','bicycle','bike','GBI','Georgia Bureau of Investigation','witness','sketch','reward','gunshot','shot','body','hunter','hunters']
def digest(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def sid(h):return 'SRC-'+str(uuid.uuid5(uuid.NAMESPACE_URL,'newspaper-pdf:sha256:'+h))
def scan(inbox,since,until,root):
 known={}
 for p in (root/'00_ADMIN/ingestion_batches').glob('*/manifest.json'):
  for x in json.loads(p.read_text()).get('files',[]):
   if x.get('sha256'):known[x['sha256']]=x.get('source_id','previous manifest')
 reg=root/'00_ADMIN/data_registers/source_files.csv'
 if reg.exists():
  with reg.open(newline='') as f:
   for x in csv.DictReader(f):known[x['sha256']]=x['source_id']
 seen={};rows=[]
 for p in sorted(inbox.iterdir()):
  if not p.is_file() or p.suffix.lower()!='.pdf':continue
  st=p.stat();birth=getattr(st,'st_birthtime',None)
  times=[x for x in [birth,st.st_mtime] if x is not None]
  if max(times)<since.timestamp() or min(times)>until.timestamp():continue
  ambiguous=birth is None or not all(since.timestamp()<=t<=until.timestamp() for t in times)
  h=digest(p);dup=known.get(h) or seen.get(h,'');seen[h]=str(p)
  pages='UNKNOWN';err=''
  try:
   import pdfplumber
   with pdfplumber.open(p) as pdf:pages=len(pdf.pages)
  except Exception as e:err=str(e)
  rows.append(dict(filename=p.name,input_path=str(p),bytes=st.st_size,created=datetime.fromtimestamp(birth,since.tzinfo).isoformat() if birth else '',modified=datetime.fromtimestamp(st.st_mtime,since.tzinfo).isoformat(),pages=pages,sha256=h,source_id=sid(h),status='AMBIGUOUS_LEAVE_ALONE' if ambiguous else 'DUPLICATE_SKIP' if dup else 'NEW',duplicate_of=dup,inspection_error=err))
 return rows

def prepare(args,rows):
 root=args.archive;batch=root/'00_ADMIN/ingestion_batches'/args.batch_id
 if batch.exists():raise ValueError('Batch already exists; refusing to overwrite or rescan it.')
 batch.mkdir(parents=True)
 manifest={'batch_id':args.batch_id,'created_at':datetime.now(timezone.utc).isoformat(),'input_directory':str(args.inbox),'since':args.since,'until':args.until,'files':rows,'state':'PREPARED_PENDING_REVIEW','collection_stop_note':args.collection_stop_note}
 # Write manifest before processing so interrupted batches are traceable.
 def checkpoint():
  temp=batch/'manifest.json.tmp';temp.write_text(json.dumps(manifest,indent=2));temp.replace(batch/'manifest.json')
 checkpoint()
 for row in rows:
  if row['status']!='NEW':continue
  src=Path(row['input_path']);raw=root/'09_SOURCE_LIBRARY/newspapers/forsyth-county-news'/args.year/'raw_pdfs'/args.batch_id/row['filename']
  raw.parent.mkdir(parents=True,exist_ok=True)
  if raw.exists():raise ValueError('Raw destination collision')
  if digest(src)!=row['sha256']:raise ValueError('Inbox file changed after discovery')
  shutil.copyfile(src,raw)
  if digest(raw)!=row['sha256']:raise ValueError('Archive copy hash mismatch')
  raw.chmod(0o444)  # guardrail, not WORM storage or a substitute for backups
  der=root/'09_SOURCE_LIBRARY/newspapers/forsyth-county-news'/args.year/'derivatives'/args.batch_id/row['source_id'];der.mkdir(parents=True)
  row['archived_file']=raw.relative_to(root).as_posix();row['archived_sha256']=digest(raw)
  try:
   import pdfplumber
   texts=[];words=[]
   with pdfplumber.open(raw) as pdf:
    row['pdf_metadata']={k:str(v) for k,v in pdf.metadata.items()}
    for page in pdf.pages:
     texts.append(page.extract_text(layout=True) or '')
     words.append({'width':page.width,'height':page.height,'words':page.extract_words()})
   text='\n\f\n'.join(texts);method='pdfplumber embedded text';quality='USABLE_REQUIRES_VISUAL_REVIEW'
   if len(re.sub(r'\s','',text))<100:
    if shutil.which('tesseract') and shutil.which('pdftoppm'):
     rendered=der/'ocr_pages';rendered.mkdir()
     subprocess.run(['pdftoppm','-r','200','-png',str(raw),str(rendered/'page')],check=True,capture_output=True)
     ocr=[]
     for im in sorted(rendered.glob('page-*.png')):
      out=subprocess.run(['tesseract',str(im),'stdout'],check=True,capture_output=True,text=True);ocr.append(out.stdout)
     (der/'embedded_text.txt').write_text(text);text='\n\f\n'.join(ocr);method='tesseract OCR';quality='OCR_REQUIRES_VISUAL_REVIEW'
    else:quality='OCR_REQUIRED_NO_LOCAL_ENGINE'
   (der/'raw_text.txt').write_text(text);(der/'word_coordinates.json').write_text(json.dumps(words))
   row.update(extraction_method=method,ocr_quality=quality,raw_text=(der/'raw_text.txt').relative_to(root).as_posix(),word_coordinates=(der/'word_coordinates.json').relative_to(root).as_posix(),term_hits={t:len(re.findall(re.escape(t),text,re.I)) for t in TERMS if re.search(re.escape(t),text,re.I)},classification='PENDING_REVIEW',processing_status='EXTRACTED_PENDING_REVIEW')
  except Exception as e:row.update(processing_status='EXTRACTION_FAILED_REVIEW_REQUIRED',extraction_error=str(e),classification='PENDING_REVIEW')
  checkpoint()
 (batch/'HUMAN_REVIEW_QUEUE.md').write_text('# Human review queue\n\nAll pages require semantic and layout review before R0–R4 classification. Keyword hits are discovery aids, not relevance decisions. Failed extraction is never R0.\n')
 print('Prepared:',batch)

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--archive',type=Path,required=True);p.add_argument('--inbox',type=Path,required=True);p.add_argument('--since',required=True,help='ISO timestamp; offset or --timezone interpreted');p.add_argument('--until',default='');p.add_argument('--timezone',default='America/New_York');p.add_argument('--year',default='1997');p.add_argument('--batch-id',required=True);p.add_argument('--collection-stop-note',default='');g=p.add_mutually_exclusive_group();g.add_argument('--execute',action='store_true');g.add_argument('--dry-run',action='store_true');args=p.parse_args()
 if not re.fullmatch(r'BATCH-[A-Z0-9-]+',args.batch_id):p.error('Unsafe batch ID')
 if not re.fullmatch(r'\d{4}',args.year):p.error('Year must be four digits')
 z=ZoneInfo(args.timezone);since=datetime.fromisoformat(args.since);since=since.replace(tzinfo=z) if since.tzinfo is None else since
 until=datetime.fromisoformat(args.until) if args.until else datetime.now(z);until=until.replace(tzinfo=z) if until.tzinfo is None else until
 if until<since:p.error('until precedes since')
 args.since=since.isoformat();args.until=until.isoformat();rows=scan(args.inbox,since,until,args.archive)
 print(json.dumps({'batch_id':args.batch_id,'dry_run':not args.execute,'files':rows},indent=2))
 if args.execute:prepare(args,rows)
if __name__=='__main__':main()
