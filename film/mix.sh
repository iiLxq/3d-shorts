#!/bin/bash
# $1 = music gain, $2 = sfx gain
ffmpeg -v error -y -i ../vo/vo.mp3 -i ../vo/music.wav -i ../vo/sfx.wav -filter_complex "\
[0:a]aresample=48000,pan=stereo|c0=c0|c1=c0,apad=whole_dur=60.5,asplit=2[vo][vosc];\
[1:a]volume=$1[m];[m][vosc]sidechaincompress=threshold=0.02:ratio=5:attack=15:release=350:makeup=1[md];\
[2:a]volume=$2[s];\
[vo][md][s]amix=inputs=3:normalize=0:duration=longest,atrim=0:60.5[mix]" -map "[mix]" -c:a pcm_s16le mix_pre.wav
ffmpeg -v error -y -i mix_pre.wav -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=summary -ar 48000 mix.wav 2>&1 | tail -3
