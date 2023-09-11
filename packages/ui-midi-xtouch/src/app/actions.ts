import { SubscrIndex } from './subscrindex';
import { Feedback_Type } from './subscrindex';

const debug = false; //holds fader positions directly, not from ui
const solo_active = false; //Solo on x-Touch now select
var easymidi, soundcraft, midiMap, config;
var page = 0,
  channel,
  current_aux = 0,
  current_selected = 0;
/*  page    channel
    0       Input 1-8
    1       Input 9-16
    2       Input 17-24
    3       Line L R / Player L R / FX 1-4
    4       Subgroup 1-6
    5       VCA 1-6
    6       AUX 1-8 Master
    7       AUX 9-10 Master

    current_aux
    1-10    aux (x-touch nur aux 1-8)
    11-14   fx (x-touch nur fx 1-2)
*/
var channel_begin = 1,
  channel_end = 24,
  line_l = 25,
  line_r = 26,
  player_l = 27,
  player_r = 28,
  fx_begin = 29,
  fx_end = 32,
  sub_begin = 33,
  sub_end = 38,
  vca_begin = 41,
  vca_end = 46,
  aux_begin = 49,
  aux_end = 58;
var subscr_fader: SubscrIndex[] = [],
  subscr_mute: SubscrIndex[] = [],
  subscr_solo: SubscrIndex[] = [],
  subscr_pan: SubscrIndex[] = [],
  subscr_master: SubscrIndex,
  subscr_mutegr: SubscrIndex[] = [];
var current_pan: number[] = new Array(8);

export class Actions {
  constructor(midi, ui, pConfig) {
    easymidi = midi;
    soundcraft = ui;
    config = pConfig
    midiMap = require('./midimap.json');
    this.init();
  }

  pitchChange(args) {
    var fader_value = args.value / 16256;
    if (fader_value > 1) fader_value = 1;
    if (debug) console.log('pitch', args);
    if (args.channel == 8) {
      //if master fader
      soundcraft.master.setFaderLevel(fader_value);
      if (debug) console.log('channel master', fader_value);
    } else {
      channel = 1 + page * 8 + args.channel - midiMap.pitch.pitch_start;
      if (!this.getChannel(channel, true)) return;
      this.getChannel(channel, true).setFaderLevel(fader_value);
    }
  }

  noteOn(args) {
    if (args.velocity == 0) return; //Nachher unmute erst bei loslassen
    if (debug) console.log('noteon', args);
    if (
      args.note >= midiMap.noteon.mute_start &&
      args.note <= midiMap.noteon.mute_end
    ) {
      //Mute
      channel = 1 + page * 8 + (args.note - midiMap.noteon.mute_start);
      if (!this.getChannel(channel, false)) return;
      this.getChannel(channel, false).toggleMute();
      return;
    } else if (
      args.note >= midiMap.noteon.solo_start &&
      args.note <= midiMap.noteon.solo_end
    ) {
      //Solo
      channel = 1 + page * 8 + (args.note - midiMap.noteon.solo_start);
      if (!this.getChannel(channel, false)) return;
      this.getChannel(channel, false).toggleSolo();
      return;
    } else if (
      args.note >= midiMap.noteon.select_start &&
      args.note <= midiMap.noteon.select_end
    ) {
      //Select
      channel = 1+ page * 8 + (args.note - midiMap.noteon.select_start);
      this.selectChannel(channel);
      return;
    } else if (
      args.note >= midiMap.noteon.center_start &&
      args.note <= midiMap.noteon.center_end
    ) {
      // Pan Center
      channel = 1 + page * 8 + (args.note - midiMap.noteon.center_start);
      if (!this.getChannel(channel, false, true)) return;
      this.getChannel(channel, false, true).pan(0.5);
      return;
    } else if (
      args.note >= midiMap.noteon.aux_start &&
      args.note <= midiMap.noteon.aux_end
    ) {
      //Select current Aux Channel
      this.aux_change(1 + args.note - midiMap.noteon.aux_start);
      return;
    } else if (
      args.note >= midiMap.noteon.fx_start &&
      args.note <= midiMap.noteon.fx_end
    ) {
      //Select current fx channel
      this.aux_change(11 + args.note - midiMap.noteon.fx_start);
      return;
    } else if (
      args.note >= midiMap.page.page_start &&
      args.note <= midiMap.page.page_end
    ) {
      //select current page directly
      this.pageSelect(args.note - midiMap.page.page_start);
      return;
    }
    switch (
      args.note //Page Select and Mute Groups
    ) {
      case midiMap.noteon.pageup:
        this.pageSelect(page + 1);
        break;
      case midiMap.noteon.pagedown:
        this.pageSelect(page - 1);
        break;
      case midiMap.noteon.mutegr1:
        soundcraft.muteGroup(1).toggle();
        if (debug) console.log('mutegroup', 1);
        break;
      case midiMap.noteon.mutegr2:
        soundcraft.muteGroup(2).toggle();
        if (debug) console.log('mutegroup', 2);
        break;
      case midiMap.noteon.mutegr3:
        soundcraft.muteGroup(3).toggle();
        if (debug) console.log('mutegroup', 3);
        break;
      case midiMap.noteon.mutegr4:
        soundcraft.muteGroup(4).toggle();
        if (debug) console.log('mutegroup', 4);
        break;
      case midiMap.noteon.mutegr5:
        soundcraft.muteGroup(5).toggle();
        if (debug) console.log('mutegroup', 5);
        break;
      case midiMap.noteon.mutegr6:
        soundcraft.muteGroup(6).toggle();
        if (debug) console.log('mutegroup', 6);
        break;
    }
  }

  ccChange(args) {
    if (debug) console.log('cc', args);
    if (
      args.controller >= midiMap.cc.pan_start &&
      args.controller <= midiMap.cc.pan_end
    ) {
      //Pan
      channel = 1 + 8 * page + args.controller - midiMap.cc.pan_start;
      if (!this.getChannel(channel, false, true)) return;
      var new_pan;
      if (args.value < 65) {
        //pan right
        new_pan =
          current_pan[args.controller - midiMap.cc.pan_start] +
          args.value * 0.01;
        if (new_pan > 1) new_pan = 1;
        this.getChannel(channel, false, true).pan(new_pan);
        if (debug) console.log('Pan r', channel, new_pan);
      } else {
        //pan left
        new_pan =
          current_pan[args.controller - midiMap.cc.pan_start] -
          (args.value - 64) * 0.01;
        if (new_pan < 0) new_pan = 0;
        this.getChannel(channel, false, true).pan(new_pan);
        if (debug) console.log('Pan l', channel, new_pan);
      }
    }
  }

  /*
    Select new page and change indication LED
    */
  private pageSelect(pPage) {
    easymidi.output.send('noteon', {
      note: midiMap.page.page_start + page,
      velocity: 0,
      channel: 0,
    });
    page = pPage;
    if (page < 0) page = 0;
    if (page > 7) page = 7;
    easymidi.output.send('noteon', {
      note: midiMap.page.page_start + page,
      velocity: 127,
      channel: 0,
    });
    this.refresh_feedback(false);
    this.feedbackSelectedChannel();
  }

  /*
    Disable all LEDs, pans center, faders to 0, page select 0
    */
  private init() {
    if (debug) {
      for (
        channel = midiMap.pitch.pitch_start;
        channel <= midiMap.pitch.pitch_end;
        channel++
      ) {
        easymidi.output.send('pitch', {
          channel: channel,
          value: 0.75 * 16256,
        });
      }
    }
    for (
      channel = midiMap.noteon.mute_start;
      channel <= midiMap.noteon.mute_end;
      channel++
    ) {
      easymidi.output.send('noteon', {
        note: channel,
        velocity: 0,
        channel: 0,
      });
    }
    for (
      channel = midiMap.noteon.solo_start;
      channel <= midiMap.noteon.solo_end;
      channel++
    ) {
      easymidi.output.send('noteon', {
        note: channel,
        velocity: 0,
        channel: 0,
      });
    }
    for (
      channel = midiMap.cc.led_start;
      channel <= midiMap.cc.led_end;
      channel++
    ) {
      easymidi.output.send('cc', {
        channel: 0,
        controller: channel,
        value: 22,
      });
    }
    for (
      channel = midiMap.noteon.aux_start;
      channel <= midiMap.noteon.aux_end;
      channel++
    ) {
      easymidi.output.send('noteon', {
        note: channel,
        velocity: 0,
        channel: 0,
      });
    }
    for (
      channel = midiMap.noteon.fx_start;
      channel <= midiMap.noteon.fx_end;
      channel++
    ) {
      easymidi.output.send('noteon', {
        note: channel,
        velocity: 0,
        channel: 0,
      });
    }
    for (
      channel = midiMap.page.page_start;
      channel <= midiMap.page.page_end;
      channel++
    ) {
      easymidi.output.send('noteon', {
        note: channel,
        velocity: 0,
        channel: 0,
      });
    }
    easymidi.output.send('noteon', {
      note: midiMap.noteon.mutegr1,
      velocity: 0,
      channel: 0,
    });
    easymidi.output.send('noteon', {
      note: midiMap.noteon.mutegr2,
      velocity: 0,
      channel: 0,
    });
    easymidi.output.send('noteon', {
      note: midiMap.noteon.mutegr3,
      velocity: 0,
      channel: 0,
    });
    easymidi.output.send('noteon', {
      note: midiMap.noteon.mutegr4,
      velocity: 0,
      channel: 0,
    });
    easymidi.output.send('noteon', {
      note: midiMap.noteon.mutegr5,
      velocity: 0,
      channel: 0,
    });
    easymidi.output.send('noteon', {
      note: midiMap.noteon.mutegr6,
      velocity: 0,
      channel: 0,
    });
    subscr_master = new SubscrIndex(8, Feedback_Type.fbPitch);
    subscr_master.setSubscription(soundcraft.master);
    subscr_mutegr[0] = new SubscrIndex(
      midiMap.noteon.mutegr1,
      Feedback_Type.fbMuteGroup
    );
    subscr_mutegr[1] = new SubscrIndex(
      midiMap.noteon.mutegr2,
      Feedback_Type.fbMuteGroup
    );
    subscr_mutegr[2] = new SubscrIndex(
      midiMap.noteon.mutegr3,
      Feedback_Type.fbMuteGroup
    );
    subscr_mutegr[3] = new SubscrIndex(
      midiMap.noteon.mutegr4,
      Feedback_Type.fbMuteGroup
    );
    subscr_mutegr[4] = new SubscrIndex(
      midiMap.noteon.mutegr5,
      Feedback_Type.fbMuteGroup
    );
    subscr_mutegr[5] = new SubscrIndex(
      midiMap.noteon.mutegr6,
      Feedback_Type.fbMuteGroup
    );
    for (var i = 0; i < 6; i++)
      subscr_mutegr[i].setSubscription(soundcraft.muteGroup(i + 1));
    this.refresh_feedback(0, true);
    this.pageSelect(0);
  }

  /*
    Select new aux/fx channel: deselect old channel and select new one
    */
  private aux_change(new_aux) {
    if (current_aux != 0) {
      if (current_aux <= 10) {
        easymidi.output.send('noteon', {
          note: midiMap.noteon.aux_start + current_aux - 1,
          velocity: 0,
          channel: 0,
        });
      } else {
        easymidi.output.send('noteon', {
          note: midiMap.noteon.fx_start + current_aux - 11,
          velocity: 0,
          channel: 0,
        });
      }
    }
    if (current_aux == new_aux || current_aux == new_aux) {
      current_aux = 0;
    } else {
      current_aux = new_aux;
      if (new_aux <= 10) {
        easymidi.output.send('noteon', {
          note: midiMap.noteon.aux_start + new_aux - 1,
          velocity: 127,
          channel: 0,
        });
      } else {
        easymidi.output.send('noteon', {
          note: midiMap.noteon.fx_start + new_aux - 11,
          velocity: 127,
          channel: 0,
        });
      }
    }
    if (debug) {
      if (current_aux <= 10) console.log('current aux ', current_aux);
      else console.log('current fx', current_aux - 10);
    }
    this.refresh_feedback(true);
  }

  private refresh_feedback(isAuxChange, isFirst = false) {
    if (isFirst) {
      for (
        var i = 0;
        i <= midiMap.pitch.pitch_end - midiMap.pitch.pitch_start;
        i++, channel++
      )
        subscr_fader[i] = new SubscrIndex(
          i + midiMap.pitch.pitch_start,
          Feedback_Type.fbPitch
        );
      for (
        var i = 0;
        i <= midiMap.noteon.mute_end - midiMap.noteon.mute_start;
        i++, channel++
      )
        subscr_mute[i] = new SubscrIndex(
          i + midiMap.noteon.mute_start,
          Feedback_Type.fbMute
        );
      if(solo_active){
        for (
          var i = 0;
          i <= midiMap.noteon.solo_end - midiMap.noteon.solo_start;
          i++, channel++
        )
          subscr_solo[i] = new SubscrIndex(
            i + midiMap.noteon.solo_start,
            Feedback_Type.fbSolo
          );
      }
      for (
        var i = 0;
        i <= midiMap.cc.pan_end - midiMap.cc.pan_start;
        i++, channel++
      )
        subscr_pan[i] = new SubscrIndex(
          i + midiMap.cc.led_start,
          Feedback_Type.fbPan
        );
    } else {
      for (var i = 0; i < subscr_fader.length; i++) {
        subscr_fader[i].unsubscribe();
      }
      if (!isAuxChange) {
        for (var i = 0; i < subscr_mute.length; i++) {
          subscr_mute[i].unsubscribe();
        }
        if(solo_active){
          for (var i = 0; i < subscr_solo.length; i++) {
            subscr_solo[i].unsubscribe();
          }
        }
        for (var i = 0; i < subscr_pan.length; i++) {
          //subscr_pan[i].unsubscribe();
        }
      }
    }
    channel = 1 + page * 8;
    for (
      var i = 0;
      i <= midiMap.pitch.pitch_end - midiMap.pitch.pitch_start;
      i++, channel++
    ) {
      //console.log(channel, i+midiMap.pitch.pitch_start);
      if (!this.getChannel(channel, true)) {
        easymidi.output.send('pitch', {
          channel: i + midiMap.pitch.pitch_start,
          value: 0,
        });
        continue;
      }
      subscr_fader[i].setSubscription(this.getChannel(channel, true));
    }
    if (!isAuxChange) {
      //MUTE
      channel = 1 + page * 8;
      for (
        var i = 0;
        i <= midiMap.noteon.mute_end - midiMap.noteon.mute_start;
        i++, channel++
      ) {
        if (!this.getChannel(channel, false)) {
          easymidi.output.send('noteon', {
            channel: 0,
            note: i + midiMap.noteon.mute_start,
            velocity: 0,
          });
          continue;
        }
        subscr_mute[i].setSubscription(this.getChannel(channel, false));
      }
      //SOLO
      if(solo_active)
      {
        channel = 1 + page * 8;
        for (
          var i = 0;
          i <= midiMap.noteon.solo_end - midiMap.noteon.solo_start;
          i++, channel++
        ) {
          if (!this.getChannel(channel, false)) {
            easymidi.output.send('noteon', {
              channel: 0,
              note: i + midiMap.noteon.solo_start,
              velocity: 0,
            });
            continue;
          }
          subscr_solo[i].setSubscription(this.getChannel(channel, false));
        }
      }
      //PAN
      channel = 1 + page * 8;
      for (
        var i = 0;
        i <= midiMap.cc.pan_end - midiMap.cc.pan_start;
        i++, channel++
      ) {
        if (!this.getChannel(channel, false, true)) {
          easymidi.output.send('cc', {
            channel: 0,
            controller: i + midiMap.cc.led_start,
            value: 0,
          });
          continue;
        }
        subscr_pan[i].setSubscription(this.getChannel(channel, false, true));
      }
    }
  }

  getChannel(channel, mindAux, isPan = false) {
    if (current_aux == 0 || !mindAux) {
      //Master channel
      if (channel >= channel_begin && channel <= channel_end) {
        if (debug) console.log('Channel', channel);
        return soundcraft.master.input(channel - channel_begin + 1);
      } else if (channel == line_l) {
        if (debug) console.log('Line L');
        return soundcraft.master.line(1);
      } else if (channel == line_r) {
        if (debug) console.log('Line L');
        return soundcraft.master.line(2);
      } else if (channel == player_l) {
        if (debug) console.log('Player L');
        return soundcraft.master.player(1);
      } else if (channel == player_r) {
        if (debug) console.log('Player R');
        return soundcraft.master.player(2);
      } else if (channel >= sub_begin && channel <= sub_end) {
        if (debug) console.log('Subgroup', channel - sub_begin + 1);
        return soundcraft.master.sub(channel - sub_begin + 1);
      } else if (channel >= fx_begin && channel <= fx_end) {
        if (debug) console.log('FX', channel - fx_begin + 1);
        return soundcraft.master.fx(channel - fx_begin + 1);
      } else if (channel >= vca_begin && channel <= vca_end && !isPan) {
        if (debug) console.log('VCA', channel - vca_begin + 1);
        return soundcraft.master.vca(channel - vca_begin + 1);
      } else if (channel >= aux_begin && channel <= aux_end && !isPan) {
        if (debug) console.log('Aux Master', channel - aux_begin + 1);
        return soundcraft.master.aux(channel - aux_begin + 1);
      }
    } else if (current_aux <= 10) {
      //AUX Sends
      if (channel >= channel_begin && channel <= channel_end) {
        return soundcraft.aux(current_aux).input(channel - channel_begin + 1);
      } else if (channel == line_l) {
        return soundcraft.aux(current_aux).line(1);
      } else if (channel == line_r) {
        return soundcraft.aux(current_aux).line(2);
      } else if (channel == player_l) {
        return soundcraft.aux(current_aux).player(1);
      } else if (channel == player_r) {
        return soundcraft.aux(current_aux).player(2);
      } else if (channel >= fx_begin && channel <= fx_end) {
        return soundcraft.aux(current_aux).fx(channel - fx_begin + 1);
      }
    } else {
      //FX sends
      if (channel >= channel_begin && channel <= channel_end) {
        return soundcraft
          .fx(current_aux - 10)
          .input(channel - channel_begin + 1);
      } else if (channel == line_l) {
        return soundcraft.fx(current_aux - 10).line(1);
      } else if (channel == line_r) {
        return soundcraft.fx(current_aux - 10).line(2);
      } else if (channel == player_l) {
        return soundcraft.fx(current_aux - 10).player(1);
      } else if (channel == player_r) {
        return soundcraft.fx(current_aux - 10).player(2);
      } else if (channel >= sub_begin && channel <= sub_end) {
        return soundcraft.fx(current_aux - 10).sub(channel - sub_begin + 1);
      }
    }
    return false;
  }

  setCurrentPan(pChannel, pValue) {
    current_pan[pChannel - midiMap.cc.led_start] = pValue;
  }

  selectChannel(channel)
  {
    var channelSelect = 255;
    if (channel >= channel_begin && channel <= channel_end) {
      channelSelect = channel - channel_begin;
    } else if (channel == line_l) {
      channelSelect = 24;
    } else if (channel == line_r) {
      channelSelect = 25;
    } else if (channel == player_l) {
      channelSelect = 26;
    } else if (channel == player_r) {
      channelSelect = 27;
    } else if (channel >= sub_begin && channel <= sub_end) {
      channelSelect = 32 + channel - sub_begin;
    } else if (channel >= fx_begin && channel <= fx_end) {
      channelSelect = 28 + channel - fx_begin;
    } else if (channel >= vca_begin && channel <= vca_end) {
      channelSelect = 48 + channel - vca_begin;
    } else if (channel >= aux_begin && channel <= aux_end) {
      channelSelect = 38 + channel - aux_begin;
    }
    if(channelSelect == 255) return;
    current_selected = channel;
    var message = 'BMSG^SYNC^' + config.sync_ID + '^' + channelSelect; 
    if(debug) console.log(message);
    soundcraft.conn.sendMessage(message);
    this.feedbackSelectedChannel();
  }

  showSelect(inboundMessage:string)
  {
      var receivedChannel = +inboundMessage.slice(11 + config.sync_ID.length);
      if (receivedChannel >= 0 && receivedChannel < 24) current_selected = channel_begin + receivedChannel;
      else if (receivedChannel == 24) current_selected = line_l;
      else if (receivedChannel == 25) current_selected = line_r;
      else if (receivedChannel == 26) current_selected = player_l;
      else if (receivedChannel == 27) current_selected = player_r;
      else if (receivedChannel >= 32 && receivedChannel < 38) current_selected = sub_begin + receivedChannel - 32;
      else if (receivedChannel >= 28 && receivedChannel < 32) current_selected = fx_begin + receivedChannel - 28;
      else if (receivedChannel >= 38 && receivedChannel < 48) current_selected = aux_begin + receivedChannel - 38;
      else if (receivedChannel >= 48 && receivedChannel < 54) current_selected = vca_begin + receivedChannel - 48;
      else current_selected = -1; //Master Channel
      this.feedbackSelectedChannel();
      if(debug) console.log("Select: " + current_selected);
  }

  feedbackSelectedChannel()
  {
    for (
      var i = 0;
      i <= midiMap.noteon.select_end - midiMap.noteon.select_start;
      i++
    ) {
      easymidi.output.send('noteon', {
        channel: 0,
        note: i + midiMap.noteon.select_start,
        velocity: 0,
      });
    }
    if(current_selected > page*8 && current_selected <= (page+1)*8)
    {
      easymidi.output.send('noteon', {
        channel: 0,
        note: current_selected - 1 - page*8 + midiMap.noteon.select_start,
        velocity: 127,
      });
    }
  }

}
