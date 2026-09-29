import argparse,csv,json,time
from pathlib import Path
from pipeline import WhisperASR,MMSASR,XLSR,extract_audio,duration

def metrics(ref,hyp):
 if not ref:return None,None
 try:
  from jiwer import wer,cer;return float(wer(ref,hyp)),float(cer(ref,hyp))
 except ImportError:return None,None

def main():
 p=argparse.ArgumentParser(description='TINE AI ASR benchmark');p.add_argument('input');p.add_argument('--language');p.add_argument('--sample-seconds',type=int,default=60);p.add_argument('--whisper-models',nargs='+',default=['small'],choices=['tiny','base','small','medium','large-v3']);p.add_argument('--include-mms',action='store_true');p.add_argument('--mms-language',default='swh');p.add_argument('--include-xlsr',action='store_true');p.add_argument('--xlsr-model-id');p.add_argument('--beam-size',type=int,default=1);p.add_argument('--reference');p.add_argument('--output-dir',default='results/asr_benchmark');a=p.parse_args()
 inp=Path(a.input)
 if not inp.exists():raise FileNotFoundError(f'Input file not found: {inp}')
 out=Path(a.output_dir);out.mkdir(parents=True,exist_ok=True);sample=Path('workdir/benchmark_sample.wav');extract_audio(inp,sample,a.sample_seconds);ref=Path(a.reference).read_text(encoding='utf-8').strip() if a.reference else None;rows=[]
 def run(name,m):
  d=duration(sample);st=time.perf_counter()
  try:r=m.transcribe(str(sample),a.language);e=time.perf_counter()-st;t=r.get('text','').strip();w,c=metrics(ref,t);pred=out/f'{name.replace("/","_")}.json';pred.write_text(json.dumps({'model':name,'audio_seconds':d,'inference_seconds':e,'real_time_factor':e/d if d else None,'text':t,'segments':r.get('segments',[]),'wer':w,'cer':c},ensure_ascii=False,indent=2),encoding='utf-8');return {'model':name,'status':'success','audio_seconds':round(d,3),'inference_seconds':round(e,3),'total_seconds':round(e,3),'real_time_factor':round(e/d,4) if d else None,'wer':w,'cer':c,'prediction_file':str(pred),'error':''}
  except Exception as ex:return {'model':name,'status':'failed','audio_seconds':round(d,3),'inference_seconds':'','total_seconds':'','real_time_factor':'','wer':'','cer':'','prediction_file':'','error':str(ex)}
 for z in a.whisper_models:rows.append(run('whisper-'+z,WhisperASR(z,a.beam_size)))
 if a.include_mms:rows.append(run('mms-'+a.mms_language,MMSASR(a.mms_language)))
 if a.include_xlsr:
  if not a.xlsr_model_id:raise ValueError('--xlsr-model-id is required with --include-xlsr')
  rows.append(run('xlsr',XLSR(a.xlsr_model_id)))
 fields=['model','status','audio_seconds','inference_seconds','total_seconds','real_time_factor','wer','cer','prediction_file','error']
 with (out/'asr_benchmark.csv').open('w',newline='',encoding='utf-8') as f:w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
 (out/'asr_benchmark.json').write_text(json.dumps({'input':str(inp),'sample_seconds':a.sample_seconds,'language':a.language,'results':rows},ensure_ascii=False,indent=2),encoding='utf-8')
 print('\nBENCHMARK COMPLETE');print(f'CSV: {out/"asr_benchmark.csv"}')
 for r in rows:print(f"{r['model']:18} {r['status']:7} time={r['inference_seconds']}s RTF={r['real_time_factor']} WER={r['wer']} CER={r['cer']}")
if __name__=='__main__':main()
