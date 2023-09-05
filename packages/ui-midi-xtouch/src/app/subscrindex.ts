import { Subscription } from 'rxjs';
import { easymidi } from '../main';
import { actions } from '../main';

export enum Feedback_Type {
  fbPitch,
  fbMute,
  fbSolo,
  fbPan,
  fbMuteGroup,
}

export class SubscrIndex {
  protected subscr: Subscription;
  protected channel;
  protected fb_type: Feedback_Type;
  constructor(pindex, pfb) {
    this.channel = pindex;
    this.fb_type = pfb;
  }

  unsubscribe() {
    this.subscr.unsubscribe();
  }

  setSubscription(pchannel) {
    switch (this.fb_type) {
      case Feedback_Type.fbPitch:
        this.subscr = pchannel.faderLevel$.subscribe((value) =>
          this.change(value)
        );
        break;
      case Feedback_Type.fbMute:
        this.subscr = pchannel.mute$.subscribe((value) => this.change(value));
        break;
      case Feedback_Type.fbSolo:
        this.subscr = pchannel.solo$.subscribe((value) => this.change(value));
        break;
      case Feedback_Type.fbPan:
        this.subscr = pchannel.pan$.subscribe((value) => this.change(value));
        break;
      case Feedback_Type.fbMuteGroup:
        this.subscr = pchannel.state$.subscribe((value) => this.change(value));
        break;
    }
  }

  getIndex() {
    return this.channel;
  }

  change(value) {
    switch (this.fb_type) {
      case Feedback_Type.fbPitch:
        easymidi.output.send('pitch', {
          channel: this.channel,
          value: value * 16256,
        });
        break;
      case Feedback_Type.fbMute:
      case Feedback_Type.fbSolo:
      case Feedback_Type.fbMuteGroup:
        easymidi.output.send('noteon', {
          channel: 0,
          note: this.channel,
          velocity: 127 * value,
        });
        break;
      case Feedback_Type.fbPan:
        easymidi.output.send('cc', {
          channel: 0,
          controller: this.channel,
          value: 17 + value * 10,
        });
        actions.setCurrentPan(this.channel, value);
        break;
    }
  }
}
