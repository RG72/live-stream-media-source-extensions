for (var key in document.streams){
  var stream=document.streams[key];
  stream.volume!=undefined && stream.video.setAttribute('data-volume',Number(stream.volume/100).toFixed(2));
  stream.video.volume=Number(stream.volume/100);
  stream.video.setAttribute('width',stream.width||600);
  stream.video.setAttribute('height',stream.height||600);
  stream.video.setAttribute('data-autoresize','none');
  stream.video.setAttribute('data-setup','{"controls": false}');

  stream.video.play().catch(function(err){
    console.log(err.toString(),err.stack);
    if (/interrupted\sby\sa\snew\sload\srequest/.test(err.toString()))finish=false;
  }).then(function(){
    console.log('success play');
  });//play
}
