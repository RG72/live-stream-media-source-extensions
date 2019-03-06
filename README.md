# live-stream-media-source-extensions
Live stream h264 encoded mp4 video on media source extensions using ffmpeg, node.js, and express. Works in chrome, firefox, safari, and android. Not iOS compatible.

```
git clone https://github.com/kevinGodell/live-stream-media-source-extensions.git

cd live-stream-media-source-extensions

npm install

node index.js
```

Open your browser to localhost:3000

# Settings

To enable autoplay tune autoplay policy in browser.
[Chrome autoplay policy](chrome://flags/#autoplay-policy)

Configure your streams in settings.js
```
listenInterface:'0.0.0.0',
listenPort:3000,
segmentTimeout:60000,
//ffmpegLogLevel:'debug',
streams:[
  {
    uri:'rtsp://user:password@192.168.1.10/axis-media/media.amp',
    volume:0,
    //segmentTimeout:120000,
  }
]
```
