ffmpeg -v error -y -i ../vo/vo.mp3 -i ../vo/music.wav -i ../vo/sfx.wav -filter_complex "\
[0:a]aresample=48000,pan=stereo|c0=c0|c1=c0,apad=whole_dur=60.5,asplit=2[vo][vosc];\
[1:a]volume=$1[m];[m][vosc]sidechaincompress=threshold=0.02:ratio=5:attack=15:release=350:makeup=1[md];\
[2:a]volume=$2[s];\
[md][s]amix=inputs=2:normalize=0,atrim=0:60.5[bed];[vo]atrim=0:60.5[v]" -map "[bed]" bed.wav -map "[v]" voonly.wav
python3 - <<'PY'
import numpy as np, scipy.io.wavfile as w
sr,b=w.read('bed.wav');_,v=w.read('voonly.wav')
b=b.astype(float).mean(1)/32768;v=v.astype(float).mean(1)/32768
db=lambda x:20*np.log10(np.sqrt(np.mean(x**2))+1e-9)
print(' '.join(f"{i}:{db(v[i*sr:(i+1)*sr])-db(b[i*sr:(i+1)*sr]):+.0f}" for i in range(60)))
print('bed', ' '.join(f"{db(b[i*sr:(i+1)*sr]):.0f}" for i in range(60)))
PY
