// jshint esversion: 6, globalstrict: true, strict: true, bitwise: true
'use strict';

//const allowedOrigins = "http://localhost:* http://127.0.0.1:*";//not sure if will need this
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http /*, {origins: allowedOrigins}*/ );
var settings=require('./settings.js');
const {spawn} = require('child_process');
const Mp4Segmenter = new require('./Mp4Segmenter');

settings.streams.forEach(function(streamCfg,idx){
  streamCfg.res=streamCfg.res||[];

  var initFFmpeg=function(){
    console.log("running ffmpeg %s",streamCfg.uri);
    var r=streamCfg.running={};
    r.mp4segmenter = new Mp4Segmenter();

    r.ffmpeg = spawn('ffmpeg', ['-loglevel', 'debug', '-reorder_queue_size', '5', '-rtsp_transport', 'tcp', '-i', streamCfg.uri,
    //'-an', //disable audio
    '-use_wallclock_as_timestamps','1',
    '-fflags','+genpts',
    '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-metadata', 'title="media source extensions"', 'pipe:1'], {
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
      clearTimeout(r.segmentTimeout);
      r.segmentTimeout=setTimeout(r.onSegmentTimeout,10000);
      streamCfg.res.forEach((res)=>{
        if (!res.initSegmentSended){
          if (!r.mp4segmenter.initSegment) return;
          res.write(r.mp4segmenter.initSegment);
          res.initSegmentSended=true;
        }

        chunk && res.write(chunk);
      });
    };//writeSegment

    r.mp4segmenter.on('initSegmentReady',(codecString)=>{
      //send only init segment
      r.writeSegment(null);
      r.ready=true;
    })

    r.close=function(){
      r.mp4segmenter.removeListener('segment', r.writeSegment);
      r.ffmpeg.stdio[1].unpipe(r.mp4segmenter);
      r.ffmpeg.stdin.pause();
      r.ffmpeg.kill();
    }

    r.onSegmentTimeout=function(){
      console.log("segmentTimeout");
      //Reload ffmpeg
      r.close();
      initFFmpeg();
    }
    r.segmentTimeout=setTimeout(r.onSegmentTimeout,10000);

    r.mp4segmenter.on('segment',r.writeSegment);
  }
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
});

app.get('/', (req, res) => {
  //res.sendFile(__dirname + '/index.html');
  res.render('index.pug',{
    settings:settings
  });
});

//app.get('/flv.min.js', (req, res) => {
//  res.sendFile(__dirname + '/node_modules/flv.js/dist/flv.min.js');
//});
app.get('/afterglow.min.js', (req, res) => {
  res.sendFile(__dirname + '/node_modules/afterglowplayer/dist/afterglow.min.js');
});

/*io.on('connection', (socket) => {
  console.log('A user connected');

  function start() {
    if (mp4segmenter.initSegment) {
      socket.emit('segment', mp4segmenter.initSegment);
      mp4segmenter.on('segment', emitSegment);
    } else {
      socket.emit('message', 'init segment not ready yet, reload page');
    }
  }

  function pause() {
    console.log('pause');
  }

  function resume() {
    console.log('resume');
  }

  function stop() {
    mp4segmenter.removeListener('segment', emitSegment);
  }

  function emitSegment(data) {
    socket.emit('segment', data);
  }

  socket.on('message', (msg) => {
    switch (msg) {
      case 'start':
        start();
        break;
      case 'pause':
        pause();
        break;
      case 'resume':
        resume();
        break;
      case 'stop':
        stop();
        break;
    }
  });

  socket.on('disconnect', () => {
    stop();
    console.log('A user disconnected');
  });
});*/

var lhost=settings.listenInterface||'127.0.0.1';
var lport=settings.listenPort||3000;
http.listen(lport,lhost, () => {
  console.log('listening on %s:%s',lhost,lport);
});
