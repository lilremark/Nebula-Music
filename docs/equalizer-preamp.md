# AutoEQ preamp

AutoEQ fixed-band profiles apply their saved preamp before Nebula's EQ filters.
Music, crossfade playback, and radio share this stage on Windows Electron and
the web. It does not change the volume setting or the visualizer's input tap.
The stage uses a Web Audio [GainNode](https://developer.mozilla.org/en-US/docs/Web/API/GainNode),
with amplitude gain computed as `10 ** (preampDb / 20)`.

- Profile application and restart restore the preamp alongside the filter gains.
- Turning EQ off bypasses both the preamp and filter gains. Turning it back on
  restores them.
- Editing individual bands retains the profile preamp. Switching to a built-in
  preset clears the profile and returns the preamp to unity.
- Clearing the profile removes its preamp but retains the band settings.
- A missing or nonfinite preamp uses 0 dB. Finite values are bounded to -60 through
  +12 dB, and Settings displays the value that the audio graph uses.
- Profile changes use a 15 ms smoothing time constant. Initial playback starts at
  the saved gain so an imported boost cannot briefly play without attenuation.

Negative preamp values provide headroom for boosts. They do not guarantee that
arbitrary manually edited or overlapping filters will never exceed full scale.
Nebula continues to use its existing output compressor and 10-band filter layout.

`npm test` checks parsing, gain conversion, saved settings, live changes, bypass,
volume independence, and routing from all three playback sources. `npm run
test:audio` renders a 0.99-amplitude 2 kHz tone through a +6 dB filter in Chromium's
OfflineAudioContext, without playing sound. With a -7 dB preamp the peak is about
0.882; without it the peak is about 1.975. Bypass preserves the original 0.99 peak,
and a live change to -12 dB settles near 0.496 without overshooting full scale.
