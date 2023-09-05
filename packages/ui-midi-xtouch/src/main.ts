// Build: nx build ui-midi-xtouch
// Run Live: nx serve ui-midi-xtouch

import { ConnectionStatus, SoundcraftUI } from 'soundcraft-ui-connection';
import { Actions } from './app/actions';

console.log('UI MIDI Control v1.0.0');

const mixerIP = '10.10.1.1';
const controller = 'X-TOUCH COMPACT';

export const easymidi = require('easymidi');
const soundcraft = new SoundcraftUI(mixerIP);

var inputs = easymidi.getInputs();
var outputs = easymidi.getOutputs();

console.log('Inputs found:', inputs);
console.log('Outputs found:', outputs);

var i;
var tinput, toutput;
for (i = 0, tinput = null; (tinput = inputs[i++]); ) {
  if (~tinput.indexOf(controller)) {
    console.log(`Found matching input "${tinput}" at index ${i - 1}.`);
    easymidi.input = new easymidi.Input(tinput);
    break;
  }
}
for (i = 0, toutput = null; (toutput = outputs[i++]); ) {
  if (~toutput.indexOf(controller)) {
    console.log(`Found matching output "${toutput}" at index ${i - 1}.`);
    easymidi.output = new easymidi.Output(toutput);
    break;
  }
}

if (!easymidi.input || !easymidi.output) {
  console.log(`No controller matching "${controller}" was found. Quitting...`);
  var sleep = require('system-sleep');
  sleep(10 * 1000); // sleep for 10 seconds
  process.exit();
}

export var actions = new Actions(easymidi, soundcraft);

soundcraft.status$.subscribe((status) => {
  console.log('Connection status', status.type);
  if (status.type == ConnectionStatus.Error) soundcraft.reconnect();
});

console.log('Connecting to', mixerIP);
soundcraft.connect();

easymidi.input.on('noteon', (args) => actions.noteOn(args));
easymidi.input.on('poly aftertouch', (args) =>
  console.log('poly aftertouch', args)
);
easymidi.input.on('cc', (args) => actions.ccChange(args));
easymidi.input.on('program', (args) => console.log('program', args));
easymidi.input.on('channel aftertouch', (args) =>
  console.log('channel aftertouch', args)
);
easymidi.input.on('pitch', (args) => actions.pitchChange(args));
easymidi.input.on('position', (args) => console.log('position', args));
easymidi.input.on('mtc', (args) => console.log('mtc', args));
easymidi.input.on('select', (args) => console.log('select', args));
easymidi.input.on('sysex', (args) => console.log('sysex', args));
