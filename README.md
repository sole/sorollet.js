````
                 _ _  _ _ || _ _|_  . _
_______________ _\(_)| (_)||(/_ | . |_\_______________________________________
                                   _|
````

# A monophonic additive synth written in Javascript.

Or: a carefully hand-made (unfinished) port from [Sorollet](http://github.com/sole/sorollet). Uses the Web Audio API.

This is a work in progress, as you might have guessed already.

## Examples

There are two examples in the ````examples```` folder.

### Listen, world

[![Listen, world](./assets/01_listen_world.png)](http://5013.es/toys/sorollet/examples/01_listen_world)

For testing the output and configuration of a synth instance. Includes an on-screen keyboard, and an "oscilloscope view" for greater fun.

In case it wasn't obvious, it's a pun on the classic "Hello, world" programming example.

* [Online](http://5013.es/toys/sorollet/examples/01_listen_world)
* [Source code](./examples/01_listen_world)

### Drum machine

[![Drum machine](./assets/02_drum_machine.png)](http://5013.es/toys/sorollet/examples/02_drum_machine)

Trying to build a semiacceptable drum machine using four Sorollet.js instances. Includes a step sequencer.

Has a very hacky implementation of "Save to .WAV". Should probably rewrite it using Web Workers, or something like that.

* [Online](http://5013.es/toys/sorollet/examples/02_drum_machine)
* [Source code](./examples/02_drum_machine)

## "Advanced" examples

* [to_the_beat // js](http://5013.es/toys/to_the_beat_js/) is a 64k intro converted to JS and using Sorollet.js for the sound.
* [MACCHINA I](http://5013.es/toys/macchina) uses an early version of Sorollet.js, too.
