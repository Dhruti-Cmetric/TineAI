# TINE AI Model Testing - Corrected Package

Files: `pipeline.py`, `evaluate_models.py`, `requirements.txt`, `README.md`.

## Install

```powershell
cd D:\IBM\TineAI
.\venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

If you need CUDA 12.1 PyTorch:

```powershell
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
```

Verify:

```powershell
python pipeline.py check-gpu
ffmpeg -version
```

## Important folder layout

Copy the four files directly into `D:\IBM\TineAI`:

```text
D:\IBM\TineAI\
  pipeline.py
  evaluate_models.py
  requirements.txt
  README.md
  my-video.mp4
  venv\
```

Then your original command works:

```powershell
python evaluate_models.py my-video.mp4 --language sw --sample-seconds 30 --whisper-models small
```

## Quick tests

```powershell
python evaluate_models.py my-video.mp4 --language sw --sample-seconds 15 --whisper-models tiny
python evaluate_models.py my-video.mp4 --language sw --sample-seconds 30 --whisper-models base small
```

Full input:

```powershell
python evaluate_models.py my-video.mp4 --language sw --sample-seconds 0 --whisper-models small
```

## Ground truth / WER / CER

Create `ground_truth.txt` containing the exact transcript for the tested sample:

```powershell
python evaluate_models.py my-video.mp4 --language sw --sample-seconds 30 --reference ground_truth.txt --whisper-models base small
```

## MMS

Swahili=`swh`, Hausa=`hau`, Yoruba=`yor`.

```powershell
python evaluate_models.py my-video.mp4 --sample-seconds 30 --include-mms --mms-language swh --whisper-models small
```

## XLS-R

Use a language-specific fine-tuned checkpoint:

```powershell
python evaluate_models.py my-video.mp4 --sample-seconds 30 --include-xlsr --xlsr-model-id YOUR_CHECKPOINT --whisper-models small
```

## Direct Whisper

```powershell
python pipeline.py transcribe my-video.mp4 --asr-backend whisper --whisper-model small --language sw --no-diarize --out results/whisper_small.json
```

## Diarization

Requires Hugging Face access/token for the pyannote gated model:

```powershell
$env:HF_TOKEN="hf_xxxxxxxxxxxxxxxxx"
python pipeline.py transcribe my-video.mp4 --asr-backend whisper --whisper-model small --language sw --diarize --out results/whisper_diarized.json
```

For ASR speed tests, omit diarization.

## Benchmark output

```text
results/asr_benchmark/
  whisper-small.json
  asr_benchmark.csv
  asr_benchmark.json
```

RTF = inference time / audio duration. Lower RTF means faster processing.

Recommended POC sequence: GPU check -> 15s tiny -> 30s base/small -> MMS -> ground-truth WER/CER -> longer benchmark -> diarization.
"# TineAI" 
