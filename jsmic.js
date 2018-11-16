(function(root, jsmic)
{
  jsmic.create = function(options)
  {
    options = options || {};

    // --- objects ---
    var _m = {
      tickms: options.tickms || 0,
      volume: options.volume || 100
    };
    var m = {
      supported: !!(root.navigator.mediaDevices && root.navigator.mediaDevices.getUserMedia),
      permitted: false,
      listening: false,
      recording: false,
      error: null,
      volume: 0,
      buffer: [],
      bufferbytes: 0,
      audioformat: {
        toString: function()
        {
          return (this.signed ? 'S' : 'U') + this.bitspersample + '_' + this.endianness;
        },
        endianness: 'LE',
        bitspersample: 16,
        signed: true
      },
      samplerate: 0
    };

    // --- functions ---
    var timeMS = Date.now || function()
    {
      return (new Date()).getTime();
    };
    var error = function(err)
    {
      m.error = err;

      if(typeof m.onerror === 'function')
      {
        m.onerror(err);
      }
    };
    var concatbuffers = (function()
    {
      var samples, offset, b, n, i;

      return function(buffers, buflen)
      {
        samples = new Float32Array(buflen);
        offset = 0;
        n = buffers.length;
        for(i=0;i<n;i++)
        {
          b = buffers[i];
          samples.set(b, offset);
          offset += b.length;
        }
        return samples;
      };
    })();
    var base64 = function(bindata, header, cb)
    {
      cb = cb || {};

      var b = new Blob([bindata], {type: 'audio/wav'});
      var r = new FileReader();
      r.onloadend = function()
      {
        cb = cb.then || cb;

        if(typeof cb === 'function')
        {
          if(header)
          {
            cb(r.result);
          }
          else
          {
            cb(r.result.substring(r.result.indexOf(',') + 1));
          }
        }
      };
      r.readAsDataURL(b);

      return cb;
    };
    var statuschanged = function()
    {
      if(typeof m.onstatus === 'function')
      {
        m.onstatus(m);
      }
    };

    // --- methods ---
    m.start = function()
    {
      if(!m.supported)
      {
        error('not supported');
        return;
      }
      if(!m.permitted)
      {
        error('permission denied');
        return;
      }
      if(!_m.stream)
      {
        root.navigator.mediaDevices.getUserMedia({audio: true, video: false}).then(function(stream)
        {
          m.supported = true;
          m.permitted = true;
          _m.stream = stream;
          m.start();

        }).catch(function(err)
        {
          error(err);
        });
        return;
      }

      m.listening = true;
      statuschanged();

      _m.context = new root.AudioContext();
      _m.source = _m.context.createMediaStreamSource(_m.stream);
      _m.processor = _m.context.createScriptProcessor(1024, 1, 1);

      _m.gain = _m.context.createGain();
      _m.source.connect(_m.gain);
      _m.gain.value = _m.volume / 100.0;

      _m.source.connect(_m.processor);
      _m.processor.connect(_m.context.destination);

      m.samplerate = _m.context.sampleRate;

      _m.buffers = [];
      _m.buflen = 0;
      _m.epochms = timeMS();

      var nch, d, i, n, epochms;
      _m.processor.onaudioprocess = function(e)
      {
        if(!m.listening)
        {
          return;
        }
        epochms = timeMS();

        nch = e.inputBuffer.numberOfChannels;
        if(!nch)
        {
          error('no input channels');
          return;
        }
        d = e.inputBuffer.getChannelData(0);

        // mix all channels to mono
        for(i=1;i<nch;++i)
        {
          e.inputBuffer.copyFromChannel(d, i, 0); // copy all data from channel i to d starting from 0 offset
        }

        _m.buffers.push(d);
        _m.buflen += d.length;

        m.tickms = epochms - _m.epochms;

        if(m.tickms >= _m.tickms)
        {
          _m.epochms = epochms;

          m.tickbuffer = concatbuffers(_m.buffers, _m.buflen);
          _m.buffers = [];
          _m.buflen = 0;

          m.volume = Math.max.apply(null, m.tickbuffer);

          if(m.recording)
          {
            m.buffer = concatbuffers([m.buffer, m.tickbuffer], m.buffer.length + m.tickbuffer.length);
            m.bufferbytes = 2 * m.buffer.length; // 16 bits is 2 bytes per element
          }

          if(typeof m.ontick === 'function')
          {
            m.ontick();
          }
        }
      };
    };
    m.stop = function()
    {
      m.listening = false;
      m.recording = false;
      statuschanged();
    };
    m.hassupport = function()
    {
      return m.supported;
    };
    m.askpermission = function()
    {
      if(!m.permitted || !_m.stream)
      {
        root.navigator.mediaDevices.getUserMedia({audio: true, video: false}).then(function(stream)
        {
          m.permitted = true;
          _m.stream = stream;
          statuschanged();

        }).catch(function(err)
        {
          m.permitted = false;
          statuschanged();

          error(err);
        });
      }
    };
    m.haspermission = function()
    {
      return m.permitted;
    };
    m.clear = function()
    {
      // clear all buffers
      _m.buffers = [];
      _m.buflen = 0;
      m.buffer = [];
      m.bufferbytes = 0;
    };
    m.record = function(autostart)
    {
      // save recorded buffers
      m.recording = true;

      if(autostart && !m.listening)
      {
        m.start();
      }
      else
      {
        statuschanged();
      }
    };
    m.save = function(filename, extension, data)
    {
      filename = filename || 'jsmic-recording.wav';
      extension = extension || filename.replace(/^.*\.([a-zA-Z0-9]+)$/gi, function($0, $1)
      {
        return $1.toLowerCase();
      });

      if(extension === 'wav')
      {
        data = data || m.wavfile();

        var b = new Blob([data], {type: 'audio/wav'});
        if(root.navigator.msSaveOrOpenBlob)
        {
          return root.navigator.msSaveOrOpenBlob(b, filename);
        }
        else
        {
          var a = document.createElement('a');
          var url = root.URL.createObjectURL(b);
          a.href = url;
          a.download = filename;
          root.document.body.appendChild(a);
          a.click();
          setTimeout(function()
          {
            a.parentNode.removeChild(a);
            root.URL.revokeObjectURL(url);
          }, 0);
          return a;
        }
      }
      else
      {
        error('unsupported filetype');
        return false;
      }
    };
    m.base64wavfile = function(header, cb)
    {
      return base64(m.wavfile(), header, cb);
    };
    m.wavfile = function()
    {
      return m.wavchunk({header: true});
    };
    m.wavchunk = function(options)
    {
      // export recorded buffers to Base64 WAV format

      options = options || {};

      var nbytes = m.bufferbytes;
      var buf = m.buffer;
      var n = buf.length;
      var samplerate = m.samplerate;
      var nch = m.nchannels || 1;
      var bps = m.audioformat.bitspersample;

      var buffer = new ArrayBuffer(nbytes);
      var view = new DataView(buffer);

      if(options.header)
      {
        // RIFF identifier
        view.setUint8(0, 'R'.charCodeAt(0));
        view.setUint8(1, 'I'.charCodeAt(0));
        view.setUint8(2, 'F'.charCodeAt(0));
        view.setUint8(3, 'F'.charCodeAt(0));

        view.setUint32(4, 44 + nbytes - 8, true); // file length

        // RIFF type
        view.setUint8(8, 'W'.charCodeAt(0));
        view.setUint8(9, 'A'.charCodeAt(0));
        view.setUint8(10, 'V'.charCodeAt(0));
        view.setUint8(11, 'E'.charCodeAt(0));

        // format chunk identifier
        view.setUint8(12, 'f'.charCodeAt(0));
        view.setUint8(13, 'm'.charCodeAt(0));
        view.setUint8(14, 't'.charCodeAt(0));
        view.setUint8(15, ' '.charCodeAt(0));

        view.setUint32(16, bps, true); // format chunk length
        view.setUint16(20, 1, true); // sample format (raw)
        view.setUint16(22, nch, true); // channel count
        view.setUint32(24, samplerate, true); // sample-rate
        view.setUint32(28, samplerate * nch * bps / 8, true); // byte-rate (= samplerate * nchannels * bitspersample / 8bitsin1byte)
        view.setUint16(32, nch * bps / 8, true); // block align (= nchannels * bytespersample / 8bitsin1byte)
        view.setUint16(34, bps, true); // bits per sample

        // data chunk identifier
        view.setUint8(36, 'd'.charCodeAt(0));
        view.setUint8(37, 'a'.charCodeAt(0));
        view.setUint8(38, 't'.charCodeAt(0));
        view.setUint8(39, 'a'.charCodeAt(0));

        view.setUint32(40, nbytes, true); // data chunk length
      }

      // view.setInt16, 3rd param is true for little endian (LE), audio-format: S16_LE
      for(var i=0,s;i<n;i++)
      {
        s = buf[i];

        if(s < 0)
        {
          if(s < -1)
          {
            view.setInt16(i+i, -32768, true);
          }
          else
          {
            view.setInt16(i+i, s * 32768, true);
          }
        }
        else
        {
          if(s > 1)
          {
            view.setInt16(i+i, 32767, true);
          }
          else
          {
            view.setInt16(i+i, s * 32767, true);
          }
        }
      }

      return view;
    };

    return m;
  };
})(window, window.jsmic = window.jsmic || {});
