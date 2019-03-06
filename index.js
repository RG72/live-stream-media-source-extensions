// jshint esversion: 6, globalstrict: true, strict: true, bitwise: true
'use strict';

//const allowedOrigins = "http://localhost:* http://127.0.0.1:*";//not sure if will need this
const app = require('express')();
const http = require('http').Server(app);
var settings=require('./settings.js');
const {spawn} = require('child_process');
const Mp4Segmenter = new require('./Mp4Segmenter');

settings.streams.forEach(function(streamCfg,idx){
  streamCfg.res=streamCfg.res||[];

  var initFFmpeg=function(){
    console.log("[%s] running ffmpeg %s",idx,streamCfg.uri);
    var r=streamCfg.running={};
    r.stat={bytes:0};
    r.mp4segmenter = new Mp4Segmenter();

    var args=['-reorder_queue_size', '5', '-rtsp_transport', 'tcp', '-i', streamCfg.uri,
    //'-an', //disable audio
    '-use_wallclock_as_timestamps','1',
    '-fflags','+genpts',
    '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-metadata', 'title="media source extensions"', 'pipe:1'];
    if (settings.ffmpegLogLevel){
      args.unshift(settings.ffmpegLogLevel);
      args.unshift('-loglevel');
    }

    r.ffmpeg = spawn('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'inherit' /* change stdio[2] inherit to ignore to hide ffmpeg debug to stderr */ ]
      //stdio:['ignore','ignore','ignore']
    });

    r.ffmpeg.on('error', (error) => {
      console.log('error', error);
    });

    r.ffmpeg.on('exit', (code, signal) => {
      console.log('exit', code, signal);
      r.close();
      initFFmpeg();
    });

    r.ffmpeg.stdio[1].pipe(r.mp4segmenter);
    r.ready=false;

    r.writeSegment=function(chunk){
      //console.log("[%s] Segment",idx);
      clearTimeout(r.segmentTimeout);
      r.segmentTimeout=setTimeout(r.onSegmentTimeout,streamCfg.segmentTimeout||settings.segmentTimeout||60000);
      streamCfg.res.forEach((res)=>{
        try{
          if (!res.initSegmentSended){
            if (!r.mp4segmenter.initSegment) return;
            res.write(r.mp4segmenter.initSegment);
            res.initSegmentSended=true;

          }
          if (chunk) r.stat.bytes+=chunk.length;
          chunk && console.log('[%s] stat:%j',idx,r.stat);
          chunk && res.write(chunk);
        }catch(e){
          console.log("res send error",e.toString());
        }
      });
    };//writeSegment

    r.mp4segmenter.on('initSegmentReady',(codecString)=>{
      console.log('[%s] initSegment',idx);
      //send only init segment
      r.writeSegment(null);
      r.ready=true;
    })

    r.close=function(){
      r.mp4segmenter.removeListener('segment', r.writeSegment);
      r.ffmpeg.stdio[1].unpipe(r.mp4segmenter);

      r.ffmpeg && r.ffmpeg.stdio[0] && r.ffmpeg.stdio[0].pause();
      r.ffmpeg && r.ffmpeg.kill && r.ffmpeg.kill();
    }

    r.onSegmentTimeout=function(){
      console.log("[%s] segmentTimeout",idx);
      //Reload ffmpeg
      r.close();
      initFFmpeg();
    }
    r.segmentTimeout=setTimeout(r.onSegmentTimeout,streamCfg.segmentTimeout||settings.segmentTimeout||60000);

    r.mp4segmenter.on('segment',r.writeSegment);
  };//initFFmpeg
  initFFmpeg();
});

app.get('/:streamId/test.mp4', (req, res) => {
  var idx=Number(req.params.streamId);
  var streamCfg=settings.streams[idx];
  if (!streamCfg){
    res.status(404);
    res.end('Have not config for '+req.params.streamId);
    return;
  }
  res.status(200);
  res.on('close', () => {
    var i=streamCfg.res.indexOf(res);
    i!=-1 && streamCfg.res.splice(i,1);
    console.log("Client disconnect from stream %s",idx);
  });
  streamCfg.res.push(res);
});

app.get('/', (req, res) => {
  res.render('index.pug',{
    settings:settings
  });
});
app.get('/afterglow.min.js', (req, res) => {
  res.sendFile(__dirname + '/node_modules/afterglowplayer/dist/afterglow.min.js');
});
app.get('/client.js', (req, res) => {
  res.sendFile(__dirname + '/client.js');
});

var lhost=settings.listenInterface||'127.0.0.1';
var lport=settings.listenPort||3000;
http.listen(lport,lhost, () => {
  console.log('listening on %s:%s',lhost,lport);
});
