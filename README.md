# jsmic
Simple javascript library to record raw data from microphone.

## Compatibility
Tested on Firefox and Chrome, but should work on any modern browser that supports the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API), and more specifically the [BaseAudioContext](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext#Browser_compatibility).

## Usage
    <input type="button" value="Start" onclick="startmic();" />
    <input type="button" value="Stop" onclick="stopmic();" />
    <span id="volumelabel"></span>
    
    <script src="jsmic.js"></script>
    <script>
    var mic = jsmic.create({
        volume: 100, // set volume to 100%
        tickms: 200  // aggregate every 0.2s
    });
    mic.onerror = function(err)
    {
        alert('Microphone error: ' + err);
    };
    mic.ontick = function()
    {
        // `mic.tickbuffer` contains all samples in a Float32Array of last tick
        // `mic.tickms` is the measured duration in milliseconds of last tick
        document.getElementById('volumelabel').innerText = Math.round(mic.volume * 100) + '%';
    };
    function startmic()
    {
        mic.start(true);
    }
    function stopmic()
    {
        mic.stop();
    }
    </script>
    

## Methods

    m.hassupport()
      Check if microphone (`navigator.mediaDevices`) is supported.
    
    m.start()
      Start listening to microphone. First call `m.askpermission()`.
    
    m.stop()
      Stop listening to microphone.
    
    m.askpermission()
      Ask user permission to use microphone, and open connection with microphone.
    
    m.haspermission()
      Check if user already gave permission.
    
    m.record(boolean autostart)
      Keep track of all samples in a single buffer, which is written to each tick.
      If autostart is true, this automatically calls `m.start()`.
    
    m.save()
      Save the recorded samples in a buffer (accessible through `m.buffer`).
    
    m.clear()
      Clear the buffer used for recording.
    
    m.savefile(string filename)
      Tell browser to give 'Save file'-dialog to download recording as an audio file (as far as this is supported), might only work if the function call originated from a click-event by the user. Only the .wav extension is currently supported. The WAV-file will contain signed 16-bit Little-Endian PCM data (S16_LE). Calls `m.wavfile()`.
    
    m.base64wavfile(boolean header)
      Get Base64-encoded WAV-data string (16-bit Little-Endian PCM; S16LE).
      If header is true, the Base64 data prefix is added ("data:audio/wav;base64,").
    
    m.wavfile()
      Alias for `m.wavchunk({header: true})`.
    
    m.wavchunk(options)
      Get raw signed 16-bit Little-Endian PCM data in a DataView container.
      If `options.header` is true, the WAV header is added - which contains information about the sample-rate, number of channels, number of bits per sample etc.
      The data contains the buffer from the last tick, or if `m.save()` was called without `m.clear()`, it uses the recorded buffer.

## Properties

    m.supported [read-only]
      True if API for microphone is supported by browser.
    
    m.permitted [read-only]
      True if permission to use microphone has been granted.
    
    m.listening [read-only]
      True if currently listening to microphone.
    
    m.recording [read-only]
      True if currently storing samples in a buffer.
    
    m.error [read-only]
      Contains details if an error was encountered.
    
    m.volume [read-only]
      Normalized number (0-1) indicating the volume within the last tick.
    
    m.nchannels [read-only]
      Number of channels. May be set in jsmic.create options. Default is 1.
    
    m.buffersize [read-only]
      Size of the buffer used to process audio-data. May be set in jsmic.create options. Has to be a power of 2, default is 1024.
    
    m.buffer [read-only]
      The buffer that samples are stored in while recording.
    
    m.bufferbytes [read-only]
      The total number of bytes in `m.buffer`.
    
    m.audioformat.toString()
      Returns audio-format string, default is "S16_LE".
    
    m.audioformat.endianness [read-only]
      Endianness of audio data, default is "LE".
    
    m.audioformat.bitspersample [read-only]
      Number of bits per sample, default is 16.
    
    m.audioformat.signed [read-only]
      True if audio data is signed, default is true.
    
    m.samplerate [read-only]
      Sample-rate of the audio data in Hz, usually either 44100 or 48000. Depends on browser implementation or configuration, only known after `m.listening` is set to true.
