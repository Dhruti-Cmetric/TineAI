import argparse,json,os,subprocess,time
from pathlib import Path
import numpy as np,soundfile as sf,torch

def gpu():
 print(f'[GPU] CUDA available: {torch.cuda.is_available()}');print(f'[GPU] torch {torch.__version__}')
 if torch.cuda.is_available():
  print(f'[GPU] Device count: {torch.cuda.device_count()}')
  for i in range(torch.cuda.device_count()): print(f'[GPU] {i}: {torch.cuda.get_device_name(i)}')

def extract_audio(src,dst,seconds=0):
 Path(dst).parent.mkdir(parents=True,exist_ok=True);c=['ffmpeg','-y','-i',str(src),'-vn','-ac','1','-ar','16000']
 if seconds>0:c+=['-t',str(seconds)]
 c+=['-c:a','pcm_s16le',str(dst)]
 try: subprocess.run(c,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 except FileNotFoundError: raise RuntimeError('FFmpeg not found. Install FFmpeg and add it to PATH.')
 except subprocess.CalledProcessError as e: raise RuntimeError(e.stderr[-2000:])

def duration(p):return float(sf.info(p).duration)

class WhisperASR:
 def __init__(self,model='small',beam=1):
  from faster_whisper import WhisperModel
  self.device='cuda' if torch.cuda.is_available() else 'cpu';self.beam=beam
  ct='float16' if self.device=='cuda' else 'int8';print(f"[Whisper] Loading {model} on {self.device} ({ct}) ...")
  self.m=WhisperModel(model,device=self.device,compute_type=ct);print('[Whisper] Loaded.')
 def transcribe(self,p,language=None):
  segs,info=self.m.transcribe(p,language=language,beam_size=self.beam,vad_filter=True,condition_on_previous_text=False)
  a=[];t=[]
  for s in segs:
   x=s.text.strip();a.append({'start':float(s.start),'end':float(s.end),'text':x})
   if x:t.append(x)
  return {'text':' '.join(t).strip(),'segments':a,'detected_language':getattr(info,'language',None)}

class MMSASR:
 def __init__(self,code='swh'):
  from transformers import AutoProcessor,Wav2Vec2ForCTC
  self.d=torch.device('cuda' if torch.cuda.is_available() else 'cpu');print(f'[MMS] Loading facebook/mms-1b-all for {code} ...')
  self.p=AutoProcessor.from_pretrained('facebook/mms-1b-all',target_lang=code);self.m=Wav2Vec2ForCTC.from_pretrained('facebook/mms-1b-all',target_lang=code).to(self.d);self.m.eval()
 def transcribe(self,p,language=None):
  a,sr=sf.read(p);a=np.mean(a,axis=1) if a.ndim>1 else a
  x=self.p(a,sampling_rate=sr,return_tensors='pt',padding=True);x={k:v.to(self.d) for k,v in x.items()}
  with torch.inference_mode(): ids=torch.argmax(self.m(**x).logits,dim=-1)
  return {'text':self.p.batch_decode(ids)[0].strip(),'segments':[]}

class XLSR:
 def __init__(self,mid):
  from transformers import AutoProcessor,AutoModelForCTC
  self.d=torch.device('cuda' if torch.cuda.is_available() else 'cpu');self.p=AutoProcessor.from_pretrained(mid);self.m=AutoModelForCTC.from_pretrained(mid).to(self.d);self.m.eval()
 def transcribe(self,p,language=None):
  a,sr=sf.read(p);a=np.mean(a,axis=1) if a.ndim>1 else a;x=self.p(a,sampling_rate=sr,return_tensors='pt',padding=True);x={k:v.to(self.d) for k,v in x.items()}
  with torch.inference_mode():ids=torch.argmax(self.m(**x).logits,dim=-1)
  return {'text':self.p.batch_decode(ids)[0].strip(),'segments':[]}

class Diarizer:
 def __init__(self):
  from pyannote.audio import Pipeline
  tok=os.getenv('HF_TOKEN')
  if not tok:raise RuntimeError('Set HF_TOKEN before using --diarize.')
  self.p=Pipeline.from_pretrained('pyannote/speaker-diarization-3.1',use_auth_token=tok)
  if torch.cuda.is_available():self.p.to(torch.device('cuda'))
 def diarize(self,p):
  o=self.p(p);return [{'start':float(t.start),'end':float(t.end),'speaker':str(s)} for t,_,s in o.itertracks(yield_label=True)]

def transcribe(inp,backend='whisper',model='small',language=None,beam=1,mms='swh',xlsr=None,do_diarize=False,out=None):
 w=Path('workdir');w.mkdir(exist_ok=True);a=w/'audio.wav';extract_audio(inp,a);d=duration(a)
 m=WhisperASR(model,beam) if backend=='whisper' else MMSASR(mms) if backend=='mms' else XLSR(xlsr) if backend=='xlsr' and xlsr else None
 if m is None:raise ValueError('XLS-R requires --asr-model-id.')
 st=time.perf_counter();r=m.transcribe(str(a),language);elapsed=time.perf_counter()-st
 r['metadata']={'input':str(inp),'backend':backend,'model':model if backend=='whisper' else (xlsr or 'facebook/mms-1b-all'),'audio_seconds':d,'inference_seconds':elapsed,'real_time_factor':elapsed/d if d else None}
 if do_diarize:r['diarization']=Diarizer().diarize(str(a))
 if out:
  Path(out).parent.mkdir(parents=True,exist_ok=True);Path(out).write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8');print(f'[Output] {out}')
 return r

def main():
 p=argparse.ArgumentParser();s=p.add_subparsers(dest='cmd',required=True);s.add_parser('check-gpu')
 x=s.add_parser('transcribe');x.add_argument('input');x.add_argument('--asr-backend',choices=['whisper','mms','xlsr'],default='whisper');x.add_argument('--whisper-model',choices=['tiny','base','small','medium','large-v3'],default='small');x.add_argument('--beam-size',type=int,default=1);x.add_argument('--language');x.add_argument('--mms-language',default='swh');x.add_argument('--asr-model-id');x.add_argument('--diarize',action='store_true');x.add_argument('--no-diarize',action='store_true');x.add_argument('--out',default='results/transcription.json')
 a=p.parse_args()
 if a.cmd=='check-gpu':gpu()
 else:transcribe(a.input,a.asr_backend,a.whisper_model,a.language,a.beam_size,a.mms_language,a.asr_model_id,a.diarize and not a.no_diarize,a.out)
if __name__=='__main__':main()
