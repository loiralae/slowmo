"""Inspect a synthetic SlowMo barcode recording, never a personal camera clip.
Requires ffmpeg/ffprobe. Usage: python3 tests/browser/inspect-recording.py FILE --orientation portrait
"""
import argparse,json,subprocess
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('file');parser.add_argument('--orientation',choices=['portrait','landscape'],required=True);args=parser.parse_args()
info=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_entries','stream=codec_name,codec_type,width,height,avg_frame_rate,duration,nb_read_frames','-of','json',args.file]))
video=next(s for s in info['streams'] if s['codec_type']=='video');duration=float(video['duration'])
assert ('portrait' if video['height']>video['width'] else 'landscape')==args.orientation,'Unexpected encoded orientation'
raw=subprocess.check_output(['ffmpeg','-v','fatal','-i',args.file,'-vf','crop=320:2:20:110,format=gray','-fps_mode','passthrough','-f','rawvideo','-'])
signatures=[sum(1<<bit for bit in range(8) if raw[offset+bit*40+20]>128) for offset in range(0,len(raw),640)]
changes=sum(a!=b for a,b in zip(signatures,signatures[1:]));rate=len(signatures)/duration;moving=changes/duration
result={'video':video,'audio':[s for s in info['streams'] if s['codec_type']=='audio'],'encoded_frames':len(signatures),'picture_changes':changes,'repeated_adjacent_frames':len(signatures)-1-changes,'encoded_fps':rate,'distinct_motion_fps':moving}
print(json.dumps(result,indent=2));assert duration>.5 and rate>=20 and moving>=20,'Saved recording motion is below the QA threshold'
