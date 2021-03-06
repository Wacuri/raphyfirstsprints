// journey_space.js -- The main page where the Curious Live Journeys are experienced.
// Copyright (C) 2018 Robert L. Read <read.robert@gmail.com>

// This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

// This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

// You should have received a copy of the GNU Affero General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.

import EventEmitter from 'events';
import React, {Component} from 'react';
import { view } from 'react-easy-state';
import { Link } from 'react-router-dom';
import Cookie from 'js-cookie';
import SwipeableViews from 'react-swipeable-views';
import { virtualize } from 'react-swipeable-views-utils';
import { mod } from 'react-swipeable-views-core';
const VirtualizeSwipeableViews = virtualize(SwipeableViews);

// import SignaturePad from './signature_pad';
import state from '../state';
import PropTypes from 'prop-types';
import uuid from 'uuid';
import {initLayoutContainer} from 'opentok-layout-js';
import './share';
import JourneyStartsIn from './journey_starts_in';
import * as LTB from './header';
import * as INTRO from './intro';

// This may not be the right way to do this
// var Rating = require('react-rating');
import Rating from 'react-rating';

import * as someHelper from './utility';

require('es6-promise').polyfill();
require('isomorphic-fetch');


// TODO: This is really a shared global!!
const MAX_PARTICIPANTS = 3;

var { OTSession, OTPublisher, OTStreams, OTSubscriber, createSession } = {};


if (__CLIENT__) {
	var { OTSession, OTPublisher, OTStreams, OTSubscriber, createSession } = require('opentok-react');
	const OT = require('@opentok/client');
    window.state = state;

    // This is my attempt not to warn the user, but to catch the event for the purpose of updating the
    // event that counts the users in the rooms.

    // On this event, our goal is to remove the participant, so that
    // the participants number is correct on the JourneyBoard.
    // This should also produce a signal that can be used,
    // just as we have at this time a signal which adds the participant.
}


// WARNING: the scoping of these two is probably not correct.
// These are needed in the event handler. I would prefer none
// of this to be global, but I am not sure how to make that happen.
var JS_GLOBAL_ROOM;
var JS_GLOBAL_SESSION_HELPER;

// Possibly this should just be on the JourneySpace
    function MYonbeforeunload(e) {

        // I need to to figure out the room parameter here...
        fetch(`/api/journeys/${JS_GLOBAL_ROOM}/unjoined`, {
	    body: JSON.stringify({id: JS_GLOBAL_SESSION_HELPER.session.connection.id}),
	    credentials: 'same-origin', // include, same-origin, *omit
	    headers: {
	        'content-type': 'application/json'
	    },
	    method: 'POST', // *GET, POST, PUT, DELETE, etc.
	    mode: 'cors', // no-cors, cors, *same-origin
	    redirect: 'follow', // manual, *follow, error
	    referrer: 'no-referrer', // *client, no-referrer
        });

        console.log("FETCH DONE");
        // For Safari
        // returning null should prevent the actual prompting...
        return;
    };

class AbstractTimerEmitter extends EventEmitter {
  _displayTime(millisec: number) {
    if (millisec < 0) { return '0:00'; }
    const normalizeTime = (time: string): string => (time.length === 1) ? time.padStart(2, '0') : time;

    let seconds: string = (millisec / 1000).toFixed(0);
    let minutes: string = Math.floor(parseInt(seconds) / 60).toString();
    let hours: string = '';

    if (parseInt(minutes) > 59) {
     hours = normalizeTime(Math.floor(parseInt(minutes) / 60).toString());
     minutes = normalizeTime((parseInt(minutes) - (parseInt(hours) * 60)).toString());
    }
    seconds = normalizeTime(Math.floor(parseInt(seconds) % 60).toString());

    if (hours !== '') {
      return `${hours}:${minutes}:${seconds}`;
    }
    return `${minutes}:${seconds}`;
  }
}

class SecondsTimerEmitter extends AbstractTimerEmitter {
  constructor(createdAt, startAt) {
    super();
    this.start = createdAt.getTime();
    this.total = startAt.getTime() - this.start;
    this.passed = new Date().getTime() - this.start;
    this.interval = setInterval(() => {
      this.passed = new Date().getTime() - this.start;
      if (this.passed >= this.total) {
        clearInterval(this.interval);
      }
      this.emit('tick', this.passed);
    }, 100);
  }

  clear() {
    clearInterval(this.interval);
  }

  displayTime() {
    return this._displayTime(this.total - this.passed);
  }

}

class AudioPlayTickEmitter extends AbstractTimerEmitter {
  constructor(audioElement) {
    super();
    this.currentTime = (audioElement.currentTime || 0) * 1000;
    this.total = audioElement.duration * 1000;
    if (audioElement.readyState === 4) {
      audioElement.addEventListener('timeupdate', this.onTimeUpdate);
      this.emit('tick', audioElement.currentTime * 1000);
    }

    audioElement.addEventListener('loadedmetadata', (e) => {
      audioElement.addEventListener('timeupdate', this.onTimeUpdate);
      this.total = e.target.duration * 1000;
      this.emit('tick', audioElement.currentTime * 1000);
    });
  }


  onTimeUpdate = (e) => {
    this.currentTime = e.target.currentTime * 1000;
    this.emit('tick', this.currentTime);
  }

  clear() {

  }

  displayTime() {
    return this._displayTime(this.total - this.currentTime);
  }
}

// const FlagControl = ({currentUserHasFlaggedStream, stream, onFlag, children}) => {
//   return (
//     <button
//       className='btn-flag-session'
//       disabled={currentUserHasFlaggedStream}
//       onClick={(e) => { e.preventDefault(); onFlag(stream); }}>
//       {children}
//     </button>
//   )
// }
class Waiting extends Component {
  constructor(props) {
    super(props);
    this.state = {
      open: true
    }
  }

  componentDidUpdate() {
    if (this.canvas) {
      var signaturePad = new SignaturePad(this.canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: '#666',
        minWidth: 1,
        maxWidth: 10,
      });

      var _this = this;
      function fadeOut() {
        var ctx = _this.canvas.getContext('2d');
        ctx.fillStyle = "rgba(0,0,0,0.01)";
        ctx.fillRect(0, 0, _this.canvas.width, _this.canvas.height);
        setTimeout(fadeOut,100);
      }

      var ctx = _this.canvas.getContext('2d');
      ctx.fillStyle = "rgba(42,42,42,1)";
      ctx.fillRect(0, 0, _this.canvas.width, _this.canvas.height);

      fadeOut();
    }
  }

  onToggle = (e) => {
    this.setState({
      open: !this.state.open
    });
  }

  render() {
    return (
      <div style={{overflow: 'hidden', position: 'relative'}}>
        {!this.state.open &&
          <div>
            <p>Chill out, draw something:</p>
            <div className='wrapper'>
              <canvas className='signature-pad' ref={el => this.canvas = el} width={400} height={400}/>
            </div>
          </div>
        }
        <div className='waiting' style={{transform: `translateY(${this.state.open ? '0' : '94%'})`, position: `${this.state.open ? 'relative' : 'absolute'}`}}>
          <a className='text-right mr-3' style={{display: 'block', color: 'white'}} href='#' onClick={this.onToggle}>{this.state.open ? 'Close X' : 'Open ^'}</a>
          <div style={{WebkitOverflowScrolling: 'touch', overflowY: 'scroll'}}>
            <iframe height='100%' width='100%' style={{width: '100%', height: '400px', border: 'none'}} src='https://docs.google.com/viewer?url=http://wacuri.herokuapp.com/CuriousLive4-Stage%20Orientation.pdf&embedded=true'/>
          </div>
        </div>
      </div>
    )
  }
}


const JOINED = 'joined';
const CREATED = 'created';
const FAILED = 'failed';
const EXPIRED = 'expired';
const STARTED = 'started';
const PAUSED = 'paused';
const COMPLETED = 'completed';
const ENDED = 'ended';
const PLAYING = 'playing';
const INTERNAL_ERROR = 'error';


// This is actually very important, this defines our
// true internal logical states and relates them to the phase indicator,
// or the public state.
// This function in fact only applies to "playerState".  The "state" on the Journey, confusingly, is something different.
function stepIndexAux(s) {
    switch(s) {
      case JOINED:
      case CREATED:
        return 0;
      case FAILED:
      case EXPIRED:
	return 3;
      case STARTED:
      case PAUSED:
        return 1;
      case COMPLETED:
	return 2;
      case ENDED:
	return 2;
    case PLAYING:
	return 1;
    case PAUSED:
	return 1;
    default: {
        console.log("INTERNAL ERROR, stepIndexAux got:",s);
        return 2;
    }
    }
}

class JourneyPhases extends Component {

  constructor(props) {
    super(props);
      // props.timer.on('tick', (current) => {
      // this.setState({
      //   timerValue: current
      // });
      // });
      // props.playTimer.on('tick', (current) => {
      // this.setState({
      //   playTimerValue: current
      // });
      // });
  }

    componentWillMount() {
        this.props.timer.on('tick', (current) => {
            this.setState({
                timerValue: current
            });
        });
    };

    componentWillUnmount() {

    };

  componentWillReceiveProps(newProps) {
    newProps.timer.on('tick', (current) => {
      this.setState({
        timerValue: current
      });
    });
  }

   get stepIndex() {
       return stepIndexAux(this.props.playerState);
   }
    // Note: setting the backgroudnColor below to orange does not work, but at least gives us a
    // gray that can be seen against the black background

    render() {
        const {journey} = this.props;
      const NumPhases = 4;
        const Messages = ["Breathe to Prepare","Journey in Progess","Share your Insights","Provide Feedback"];
    return (
	    <div ref={el => {this.container = el}} className={`journey-timeline step-${this.stepIndex.toString()}`}>
	    <div>
	    <div className={'phase-and-timer'}>
	    <span>{Messages[this.stepIndex]}</span>
	{ (((state.journey.startAt &&
	     (this.stepIndex == 0))) || (this.stepIndex == 1) ) &&
          <div className='fixed-box'>
          <span className='timer'>{this.props.timer.displayTime()}</span>
          </div>
	}
	    </div>
	    </div>
	</div>
    )
  }
}

class PhaseIndicator extends Component {
  constructor(props) {
    super(props);
  }
    get stepIndex() {
        if (this.props.showingFeedback) {
            return 3;
        } else {
            return stepIndexAux(this.props.playerState);
        }
    }
    // Note: setting the backgroudnColor below to orange does not work, but at least gives us a
    // gray that can be seen against the black background

  render() {
      const {journey} = this.props;
      const NumPhases = 4;
      const Messages = ["Breathe and center yourself","Journey in Progess","Share your Insights","Provide Feedback"];
//      console.log("PHASE INDICATOR RENDERED");
    return (
	    <div id={'phase-bar0'}>
	    <div className={ `phase-bar bar-${this.stepIndex == 0 ? 'white' : 'green'}`}>
	      </div>
	    <div className={ `phase-bar bar-${this.stepIndex == 1 ? 'white' : 'green'}`}>
	      </div>
	    <div className={ `phase-bar bar-${this.stepIndex == 2 ? 'white' : 'green'}`}>
	      </div>
	    <div className={ `phase-bar bar-${this.stepIndex == 3 ? 'white' : 'green'}`}>
	      </div>
	    </div>
    )
  }
}


class SkipButtonClear extends Component {
    constructor(props) {
       super(props);
    }
    skipToNext = (e) => {
	console.log("SKIP TO NEXT CALLED");
	e.preventDefault();
   // This seeking to near the end works better than just calling skip, because it allows our natural processes to continue.
    // fetch(`/api/journeys/${this.props.journey.room}/skip`, {
    //   cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
    //   credentials: 'same-origin', // include, same-origin, *omit
    //   headers: {
    //     'content-type': 'application/json'
    //   },
    //   method: 'POST', // *GET, POST, PUT, DELETE, etc.
    //   mode: 'cors', // no-cors, cors, *same-origin
    //   redirect: 'follow', // manual, *follow, error
    //   referrer: 'no-referrer', // *client, no-referrer
    // });
      // I believe this should change the state to completed, but I am not sure
      // if that happens server side or client side
	console.log("skipToNext event fired");
	const vid = this.props.vidid;
	const playerState = this.props.playerState;
	const seekTo = this.props.seekTo;
	// This is my attempt to seek to the end....
	// It is not clear how the audio really works; I am not sure that "seek" functions.
	seekTo(99/100);
	// figure out how to pause, and how to seek correctly....
  }

    render() {
	return (<div id={'imageskipbutton'}>
		<span className={'invisible-finger-target'}>
		<span className={`fa-stack`} onClick={this.skipToNext}
	    style={{zIndex: 2}}>
	    {
            <i className={`fa fa-step-forward fa-stack-1x`}
	     style={{color: 'white'}}></i>
	     }
		</span>
		</span>
		</div>
    )
  }
}

class VideoButton extends Component {
  constructor(props) {
    super(props);
    this.state = {
      publishing: true
    }
  }

  toggle = (e) => {
    e.preventDefault();
      const {publisher} = this.props;
      console.log("TOGGLE: PUBLIHSER ", publisher);
      if (publisher && publisher.state && publisher.state.publisher) {
	  publisher.state.publisher.publishVideo(!this.state.publishing);
	  this.setState({
              publishing: !this.state.publishing
	  });
      }
  }

    render() {
    return (
	    <span className={`fa-stack`} onClick={this.toggle}>
	    <i className='fa fa-circle fa-stack-2x'
	style={{color: `${this.state.publishing ? 'rgb(75,176,88)' : 'red'}`}}
	    ></i>
	    { this.state.publishing &&
	    <i className={`fas fa-video fa-stack-1x`}
		style={{color: 'white'}}>
		</i>
	    }
	{ !this.state.publishing &&
	    <i className={`fas fa-video-slash fa-stack-1x`}
		style={{color: 'white'}}>
		</i>
	    }
		 </span>
    )
  }
}

class AudioButton extends Component {

  constructor(props) {
    super(props);
    this.state = {
      publishing: true
    }

    // This binding is necessary to make `this` work in the callback -- ROB IS TRYING THIS
    this.toggleMicrophone = this.toggleMicrophone.bind(this);
  }

    componentDidUpdate(prevProps) {
  // Typical usage (don't forget to compare props):
  if (this.props.userID !== prevProps.userID) {
      this.fetchData(this.props.userID);
  }
}

    changeToggleValue = () => {
	this.setState((prevState) => {
	    var curMuted = this.props.state.microphoneMuted;
	    this.props.setMicrophoneMutedState(!curMuted);
	    return { publishing: !prevState.publishing};
	});

    };

    toggleMicrophone = (e) => {
	const DEBUG_MUTE = 0;
	e.preventDefault();
      const {publisher} = this.props;
      if (DEBUG_MUTE) {
	  console.log("Initial Publishing State:",this.state.publishing);
	  console.log(publisher,publisher.state,publisher.state.publisher);
      }
	// ON SAFARI, this state is never changing!

    if (publisher && publisher.state && publisher.state.publisher) {
	publisher.state.publisher.publishAudio(!this.state.publishing);
	this.changeToggleValue();
    }
	if (DEBUG_MUTE) {
	  console.log("FINAL this.publishing:",this.state.publishing);
	  console.log("FINAL state:",this.state);
      }

	// This is absolutely necessary, but insuffient to make it work properly.
	e.stopPropagation();
  }


    render() {
    return (
	    <span className={`fa-stack`} onClick={this.toggleMicrophone}>
	    <i className={`fa fa-circle fa-stack-2x`}
	   style={{color: `${!this.props.state.microphoneMuted ? 'rgb(75,176,88)' : 'red'}`}}
	    ></i>
	    {
            <i className={`fa ${!this.props.state.microphoneMuted ? 'fa-microphone' : 'fa-microphone-slash'}  fa-stack-1x`}
	     style={{color: 'white'}}></i>
	     }
		 </span>


    )
  }
}

class PlayButton extends Component {

  constructor(props) {
    super(props);
    this.state = {
      paused: (props.player && props.player.paused) || true
    }
      props.player.addEventListener('play', () => {
      this.setState({
        paused: false
      });
    // This binding is necessary to make `this` work in the callback -- ROB IS TRYING THIS
    this.togglePlay = this.togglePlay.bind(this);
    });

    props.player.addEventListener('pause', () => {
      this.setState({
        paused: true
      });
    });
  }

    togglePlay = (e) => {
    e.preventDefault();
    setTimeout(() => {
      if (state.audioTag.paused) {
        fetch(`/api/journeys/${this.props.journey.room}/start`, {
          cache: 'no-cache',
          credentials: 'same-origin',
          headers: {
            'content-type': 'application/json'
          },
          method: 'POST',
          mode: 'cors',
        });
      } else {
        fetch(`/api/journeys/${this.props.journey.room}/pause`, {
          cache: 'no-cache',
          credentials: 'same-origin',
          headers: {
            'content-type': 'application/json'
          },
          method: 'POST',
          mode: 'cors',
        });
      }
    }, 20);
  }

    render() {
    return (
	    <span className='fa-stack play-button' onClick={this.togglePlay}>
            {/*            <i className={`fa fa-${state.audioTag.paused ? 'pause' : 'play'} fa-stack-1x`}
	     style={{color: 'white'}}></i>
             */}
            <img src={'../images/' + (state.audioTag.paused ? 'PlayButton.svg' : 'PauseButton.svg')}/>
	    </span>
    )
  }
}

class PlaceHolderButton extends Component {
  constructor(props) {
    super(props);
  }
    render() {
        return (
              <span className='fa-stack placeholder' onClick={this.togglePlay}>
                <i className='fa fa-circle fa-stack-2x'
            style={{color: 'rgb(74,170,221)'}}
                ></i>
                {
                   <i className={`fa fa-play fa-stack-1x`}
                    style={{color: 'white'}}></i>
                }
            </span>
    )
  }
}

// This is oddly similar and anti-symmetric to the PlayButton.
class PauseButton extends Component {
  constructor(props) {
    super(props);
    this.state = {
      paused: (props.player && props.player.paused) || true
    }
      props.player.addEventListener('play', () => {
      this.setState({
        paused: false
      });
    // This binding is necessary to make `this` work in the callback -- ROB IS TRYING THIS
    this.togglePlay = this.togglePlay.bind(this);
    });

    props.player.addEventListener('pause', () => {
      this.setState({
        paused: true
      });
    });
  }

    togglePlay = (e) => {
    e.preventDefault();
    setTimeout(() => {
      if (state.audioTag.paused) {
        fetch(`/api/journeys/${this.props.journey.room}/start`, {
          cache: 'no-cache',
          credentials: 'same-origin',
          headers: {
            'content-type': 'application/json'
          },
          method: 'POST',
          mode: 'cors',
        });
      } else {
        fetch(`/api/journeys/${this.props.journey.room}/pause`, {
          cache: 'no-cache',
          credentials: 'same-origin',
          headers: {
            'content-type': 'application/json'
          },
          method: 'POST',
          mode: 'cors',
        });
      }
    }, 20);
  }

    render() {
    return (
	    <span className='fa-stack' onClick={this.togglePlay}>
	    <i className='fa fa-circle fa-stack-2x' onClick={this.togglePlay}
	style={{color: 'rgb(75,176,88)'}}
	    ></i>
	    {
            <i className={`fa fa-${state.audioTag.paused ? 'pause' : 'play'} fa-stack-1x`}
	     style={{color: 'white'}}></i>
	     }
		 </span>
    )
  }
}

class SharePrompt extends Component {

  render() {
    return (
      <div className='journeyspace-sharePrompt' style={{textAlign: 'center'}}>
        <p style={{fontFamily: 'Playfair Display, serif', fontSize: '25px', lineHeight: 0.8}}>If you would like to invite a friend you can make this a permanent JourneySpace:</p>
        <button className='btn btn-primary' onClick={this.props.onInvite}>Invite Friends</button>
      </div>
    )
  }
}

class InviteModal extends Component {
  constructor(props) {
    super(props);
    this.state = {
        journeySpaceName: '',
        linkCopied: false,
        error: false
    }
  }

    updateLink = (url) => {
      document.getElementById("personal-link-url").value = url;

      var span = document.getElementById("personal-link-url");
      while( span.firstChild ) {
        span.removeChild( span.firstChild );
      }
        span.appendChild( document.createTextNode(url ));
    }

    onChange = (e) => {
    e.preventDefault();
    this.setState({
      journeySpaceName: e.target.value,
      error: this.state.error && e.target.value != ''
    });

      const name = this.state.journeySpaceName;
      const urlFriendlyName = name.replace(/[^\w]/g, '-').toLowerCase();
      const url = `${window.location.protocol}//${window.location.host}/${urlFriendlyName}`;
      this.updateLink(url);

      e.stopPropagation();
  }

  onCopy = (e) => {
    e.preventDefault();
    if (this.state.journeySpaceName === '') {
      this.setState({
        error: 'please enter a name'
      });
    } else {
      this.setState({
        error: false
      });
      const name = this.state.journeySpaceName;
      const urlFriendlyName = name.replace(/[^\w]/g, '-').toLowerCase();
      const url = `${window.location.protocol}//${window.location.host}/${urlFriendlyName}`;
        const success = this._copy(url);
      if (success) {
          //        this.props.onComplete(url, name);
        this.setState({
            linkCopied: true
        });
      } else {
          this.setState({
              linkCopied: false,
              error: 'failed to copy url'
        });
      }
    }
  }

    onGoThereNow = (e) => {
        console.log("onGoThereNow","A");
        e.preventDefault();
        if (this.state.journeySpaceName === '') {
            this.setState({
                error: 'please enter a name'
            });
        } else {
            this.setState({
                error: false
            });
            const name = this.state.journeySpaceName;
            const urlFriendlyName = name.replace(/[^\w]/g, '-').toLowerCase();
            const url = `${urlFriendlyName}`;
            // const success = this._copy(url);
            console.log("onGoThereNow",url);
            this.props.history.push(url);
            this.props.onComplete(url,name);
        }
    }


  _copy(url) {
    // A <span> contains the text to copy
    const span = document.createElement('span');
    span.textContent = url;
    span.style.whiteSpace = 'pre'; // Preserve consecutive spaces and newlines

    // Paint the span outside the viewport
    span.style.position = 'absolute';
    span.style.left = '-9999px';
    span.style.top = '-9999px';

    const win = window;
    const selection = win.getSelection();
    win.document.body.appendChild(span);

    const range = win.document.createRange();
    selection.removeAllRanges();
    range.selectNode(span);
    selection.addRange(range);

    let success = false;
    try {
        success = win.document.execCommand('copy');
    } catch (err) {}

    selection.removeAllRanges();
    span.remove();

    return success;
  }

    componentDidUpdate(prevProps) {
        const name = this.state.journeySpaceName;
        const urlFriendlyName = name.replace(/[^\w]/g, '-').toLowerCase();
        const url = `${window.location.protocol}//${window.location.host}/${urlFriendlyName}`;
        this.updateLink(url);
    }

    // TODO: The x here is two small, it should be removed from here and put in CSS
    render() {
//        console.log("function",this.onGoThereNow);
    return (
            <div className='journeyspace-invite'>
              <a href='#' onClick={this.props.onClose} style={{position: 'absolute', right: '20px', top: '20px'}}>
                <i className='fa fa-times' style={{color: 'white'}}/>
              </a>
              <div className='invite-container'>
                <div className='invite-message-square'>
                  <div>You can name and share a permanent CuriousLive JourneySpace with your Friends</div>
            <button className={(this.state.journeySpaceName == '') ? 'perm-room-button' : 'perm-room-button-disabled'} onClick={this.onGoThereNow}>
            {(this.state.journeySpaceName == '') ? 'Enter a Name' : 'Go There Now'}
 	        </button>
                </div>
            <div className='invite-control-square'>
            <div>
              <div>Name your space:</div>
              <input type='text' value={this.state.journeySpaceName} onChange={this.onChange} placeholder='Name Your Space'/>
              {this.state.error && <p className='text-danger'>{this.state.error}</p>}
              <div className='sharing-block'>
                 <div>Share Using:</div>
                    <div onClick={this.onCopy} style={{ margin: '0 auto', cursor: 'pointer'}}>
               <i className='fa fa-link' style={{position: 'relative', display: 'flex', color: 'gray', background: 'white', width: '70px',height: '70px', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', fontSize: '38px'}}>
              {this.state.linkCopied &&
               <span className='status-message'>
             Link&nbsp;Copied
               </span>
              }
               </i>
              </div>
              <div style={{position: 'relative'}}>Copy Link
              </div>
            </div>
            </div>
            {/* this needs to be moved out of flex-box */}
            <div>Your link:</div>
            <p id='personal-link-url'> </p>
            </div>
            </div>

            </div>
    )
  }
}

class UnfilledVideoSquare extends React.Component {
  constructor(props) {
      super(props);
  }
    // TODO: onFlag must be moved here
  render() {
      const vid = this.props.vidid;
      const slength = this.props.streamlength;
      const stream = this.props.stream;
      const session = this.props.session;
      const localkey = this.props.localkey;
      const limit = this.props.limit;
      const state = this.props.state;
      const journey = this.props.journey;
      const sessionId = this.props.sessionId;
      const hasFlagged = (stream) ? !!journey.flags.find(flag => flag.user === sessionId && flag.flagged === stream.id) : false;
      const visible = this.props.visible;
      const hide_control = (!visible) ||
      	    !(state.playerState == "waiting" ||
	      state.playerState == "failed" ||
             state.playerState == "joined");
      const additionalClass = this.props.additionalClass;

      return ((slength < limit) ?
	      <div key={localkey} id={vid} className={`${additionalClass} flex-box video-placeholder`}>
	      <div className='box-content'
	      style={{visibility: `${hide_control ? 'hidden' : 'visible'}` }}>
              <i className='far fa-smile'></i>
              <p style={{color: 'white', maxWidth: '80%', margin: '0 auto'}}>Waiting...</p>
              <p/>
              <button className='invite-button invite-friends-button'  onClick={this.props.onInvite}>Invite Friends
	        </button>
	      </div>
	      </div>
				     :
	      <div key={localkey} id={vid} className='PartnerStream'
	      >
                            <OTSubscriber
                              key={stream.id}
                              session={session}
                              stream={stream}
                              properties={{
                                width: '100%',
                                height: '100%',
                              }}
              />
              {/*
                          <div className='journeyspace-stream-controls'>
              <FlagControl currentUserHasFlaggedStream={hasFlagged}
	          onFlag={this.onFlag} stream={stream.id}>
              <i style={{color: hasFlagged ? 'red' : 'white'}}
	          className='fa fa-flag'></i>
                              </FlagControl>
                            </div>
               */}
                        </div>
		    ); }
}

class NoVideoSquare extends React.Component {
  constructor(props) {
      super(props);
  }
  render() {
      const localkey = this.props.localkey;
      const vid = this.props.vidid;
      const feedbackNotOrientation =
	    this.props.playerState == ENDED || this.props.playerState == COMPLETED;
      const msg = (feedbackNotOrientation) ? "Leave and Give Feedback" : "Orientation";
      const topmsg = (feedbackNotOrientation) ? "When all sharing is done..." : "Waiting...";
      const topmsgvis = (feedbackNotOrientation) ? "visible" : "hidden";
      const fnc = (feedbackNotOrientation) ? this.props.onFeedback : this.props.onOrientation;
      const additionalClass = this.props.additionalClass;
	  return (
		  <div key={localkey} id={vid} className={`${additionalClass} flex-box video-placeholder`}>
	        <div className='box-content'>
	      <i className='far fa-smile'  style={{ visibility: 'hidden'}}></i>

		  <p style={{visibility: `${topmsgvis}`, color: 'white', maxWidth: '80%', margin: '0 auto'}}>{topmsg}</p>
              <p/>
	      {/* We need to create a colore class to unify with invite-friends-button */}
                  <button className='invite-button invite-orientation-button' onClick={fnc}
 	              >{msg}</button>
  	         </div>
		  </div>);
  }
}
// return null if not a permanent-room, return the name if it is a permanent room.
function isPermanentRoom(url) {
    console.log("URL",url);
}


class Controls extends Component {
    constructor(props) {
	super(props);
    }
    render() {
	return (
		<div id='central_control_panel_id' className='centered' style={this.props.visibility}>
		  <AudioButton publisher={this.props.publisher}
  		         state={this.props.state}
		         setMicrophoneMutedState={this.props.setMicrophoneMutedState}
		  />
	          <PlaceHolderButton publisher={this.props.publisher}/>
		  <PlayButton style={{color: 'rgb(74,170,221)',
				    backgroundColor: 'rgb(75,176,88)', borderRadius: '50%', }}
	            journey={this.props.journey} player={this.props.player}/>
		  <VideoButton publisher={this.props.publisher}/>
	        </div>
	);
    }

}



export class JourneySpace extends Component {
  constructor(props) {
      super(props);
      this.state = {
	  microphoneMuted: false,
      streams: [],
      publisherId: '',
      session: null,
      playerState: JOINED,
      playerProgress: 0,
      playerProgressMS: 0,
      journeyDuration: 0,
      currentlyActivePublisher: null,
	showInviteModal: false,
	showOrientationModal: false,
	showFeedbackModal: false,
//	  showIntro: true,
	  permanentRoom: false, // what is publisher?
	  journey: null,
      }
      this.publisher = {};
      this.audioTag = {};
  }

    // This is needed because of the
    // the fact that the event is invoked separately.



    componentDidMount() {

	state.audioTag.addEventListener('ended', (event) => {
	    this.setState({
		playerState: ENDED
	    });

	    console.log("DOING /completed fetch");
	    fetch(`/api/journeys/${this.props.match.params.room}/completed`, {
		cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
		credentials: 'same-origin', // include, same-origin, *omit
		headers: {
		    'content-type': 'application/json'
		},
		method: 'POST', // *GET, POST, PUT, DELETE, etc.
		mode: 'cors', // no-cors, cors, *same-origin
		redirect: 'follow', // manual, *follow, error
		referrer: 'no-referrer', // *client, no-referrer
	    });

	    if (decodeURIComponent(state.audioTag.src) === `${window.location.origin}${state.journey.journey}`) {
		state.audioTag.enqueue(['/chime.mp3', '/sharing.mp3']).then(() => {
		    // sharing audio ended
		});
		state.audioTag.play();
	    }
	});

	fetch(`/api/journeys/${this.props.match.params.room}${window.location.search}`, {credentials: 'include'})
	    .then(res => res.json())
	    .then(json => {
		state.journey = json;

		state.audioTag.src = state.journey.journey;

		state.audioTag.currentTime = 0;

		this.sessionHelper = createSession({
		    apiKey: state.openTokKey,
		    sessionId: state.journey.sessionId,
		    token: state.journey.token,
		    onConnect: () => {
			console.log('assigned connection to publisher', this.sessionHelper.session.connection);
                        // This is where the participant is joined,
                        // and we probably need to make an inversion of this
                        // function which removes the participant.

                        // WARNING: This is an ugly, temporary solution
                        JS_GLOBAL_ROOM = this.props.match.params.room;
			fetch(`/api/journeys/${this.props.match.params.room}/joined`, {
			    body: JSON.stringify({id: this.sessionHelper.session.connection.id}),
			    credentials: 'same-origin', // include, same-origin, *omit
			    headers: {
				'content-type': 'application/json'
			    },
			    method: 'POST', // *GET, POST, PUT, DELETE, etc.
			    mode: 'cors', // no-cors, cors, *same-origin
			    redirect: 'follow', // manual, *follow, error
			    referrer: 'no-referrer', // *client, no-referrer
			}).then(function(response) {
                            if (!response.ok) {
                                console.log("throwing",response);
                                throw Error(response.statusText);
                            }
                        }).catch(function(error) {
                            console.log(error);
                            // This returns them to journey board.
                            // Basically at this point we want
                            // to make very sure we don't render any streams.
                            // I am not sure how to do this.
                        });
		    },
		    onStreamsUpdated: streams => {
			console.log('Current subscriber streams:', streams);
                        // We substract one here becase the owner if this
                        // page counts as a participant who is not a subscriber
                        // stream
                        if (streams.length+1 > MAX_PARTICIPANTS) {
                            console.log("RETREATING BECAUSE TOO MANY USERS");
                            alert("Too Many users");
                            this.props.history.push('/');
                        }
			this.setState({ streams });
			if (!this.state.currentlyActivePublisher) {
			    this.setState({
				currentlyActivePublisher: streams[0]
			    });
			}
		    }
		});

                JS_GLOBAL_SESSION_HELPER = this.sessionHelper;

                // Now we can add this event listener
                if (__CLIENT__) {
                    window.addEventListener('beforeunload', MYonbeforeunload);
                }


		this.sessionHelper.session.on("connectionDestroyed", (event) => {
		    const data = {
			sessionId: this.sessionHelper.session.sessionId,
			connection: {
			    id: event.connection.id
			},
			event: 'connectionDestroyed',
		    }
		    this.refreshSession();
		});
		this.sessionHelper.session.on("connectionCreated", (event) => {
		    this.refreshSession();
		});
		this.sessionHelper.session.on('signal', (event) => {
		    console.log("Signal sent from connection ", event);
//		    this.refreshSession();
		});

		this.sessionHelper.session.on("signal:startJourney", (event) => {
		    if (this.publisher && this.publisher.state && this.publisher.state.publisher) {
			this.publisher.state.publisher.publishAudio(false);

		    }
		    const playPromise = state.audioTag.play();
		    if (playPromise !== undefined) {
			playPromise
			    .then(() => {
//				console.log('audio promise resolve');
			    })
			// Safety first!
			    .catch(e => {
				console.error(e);
			    });
		    }
		    this.setState({
			playerState: PLAYING,
			// we also want to mute the microphone here!
			microphoneMuted: true,
		    });
		    // In theory, this could be the place to mute microphones
//		    console.log("MUTE HERE!!!!!!");
		});

		this.sessionHelper.session.on("signal:pauseJourney", (event) => {
		    if (this.publisher && this.publisher.state && this.publisher.state.publisher && !this.state.microphoneMuted) {
			//            this.publisher.state.publisher.publishAudio(true);
		    }
		    state.audioTag.pause();
		    this.setState({
			playerState: PAUSED
		    });
		});

		this.sessionHelper.session.on("signal:journeyUpdated", (event) => {
		    const journey = JSON.parse(event.data);
		    // Rob doesn't understand this apparently I have to call setState and use the statement above?
		    state.journey = journey;
		    this.setState({
			journey: journey
		    });
		    console.log(" Got signal:journeyUpdated ", event, journey);

		    if (state.journey.state != COMPLETED) {
			// if we are in completed state, then audio may be playing the sharing prompt
			state.audioTag.src = state.journey.journey;
			state.audioTag.currentTime = 0;
		    }

		    if (state.journey.state === STARTED) {

			if (this.publisher && this.publisher.state && this.publisher.state.publisher) {
			    this.publisher.state.publisher.publishAudio(false);
			}
			state.audioTag.play();
			this.setState({
			    playerState: 'playing'
			});
		    }
		});


		this.sessionHelper.session.on("signal:fail", (event) => {
		    state.journey.state = FAILED;
			this.setState({
			    playerState: FAILED
			});
		});

		this.sessionHelper.session.on("signal:roomTooFull", (event) => {
                    alert("ROOM TOO FULL!");
		});


		this.setState({
		    session: this.sessionHelper.session
		});

		const onAudioCanPlay = (event) => {
		    if (state.journey.state === STARTED) {
			state.audioTag.play();
			if (!isNaN(state.journey.currentTime)) {
			    state.audioTag.currentTime = state.journey.currentTime;
			}
		    }
		    state.audioTag.removeEventListener('canplaythrough', onAudioCanPlay);
		}

		state.audioTag.addEventListener('canplaythrough', onAudioCanPlay, false);
		state.audioTag.load();
	    });
	fetch('/api/journeys')
	    .then(res => res.json())
	    .then(json => {
		state.journeys = json;
	    });
    }

  componentWillUnmount() {
    if (this.sessionHelper) {
      this.sessionHelper.disconnect();
    }
      if (this.playerTimeEmitter) {
          this.playerTimeEmitter.clear();
          this.playerTimeEmitter = null;
      }
      if (this.secondsEmitter) {
          this.secondsEmitter.clear();
          this.secondsEmitter = null;
      }
  }

  refreshSession = () => {
		fetch(`/api/journeys/${this.props.match.params.room}`, {credentials: 'include'})
			.then(res => res.json())
	  .then(json => {

//	      this.setState({
		  state.journey = json
//	      })
			});
      setTimeout(someHelper.setSizes,1000);
  }

  get timeRemaining() {
    const seconds = this.state.journeyDuration - this.state.playerProgressMS;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(0);
    return minutes + ":" + (remainingSeconds < 10 ? '0' : '') + remainingSeconds;
  }

  get isHostUser() {
    const currentParticipant = this.state.session && this.state.session.connection && state.journey && state.journey.participants.find(participant => participant.connectionId === this.state.session.connection.id);
    return currentParticipant && state.journey.participants.indexOf(currentParticipant) === 0
  }

    get journeyStateTimer() {
        switch(this.state.playerState) {
        case JOINED:
        case CREATED:
            if (!this.secondsEmitter) {
                this.secondsEmitter = new SecondsTimerEmitter(new Date(state.journey.createdAt), new Date(state.journey.startAt));
            }
            return this.secondsEmitter;
        case FAILED:
        case EXPIRED:
        case STARTED:
        case PLAYING:
        case PAUSED:
        case ENDED:
        case COMPLETED:
            if (!this.playerTimeEmitter) {
                this.playerTimeEmitter = new AudioPlayTickEmitter(state.audioTag);
            }
            return this.playerTimeEmitter;
        default:
            console.log("XXXX",this.state.playerState);
            return null;
        }
  }

  onInitPublisher = () => {
      console.log('initialized publisher');
      // Possibly this means publisher should be moved into the state!
      this.setState(state: state);
  }

  onConfirmReady = (e) => {
    fetch(`/api/journeys/${this.props.match.params.room}/connections/${this.sessionHelper.session.connection.id}/ready`);
  }


    // how can it be that the argument is not used here?
    onChangeJourney = (e) => {
	console.log("onChangeJourney",e);
    fetch(`/api/journeys/${this.props.match.params.room}/journey`, {
      body: JSON.stringify({journey: e.target.value}), // must match 'Content-Type' header
      cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
      credentials: 'same-origin', // include, same-origin, *omit
      headers: {
        'content-type': 'application/json'
      },
      method: 'PUT', // *GET, POST, PUT, DELETE, etc.
      mode: 'cors', // no-cors, cors, *same-origin
      redirect: 'follow', // manual, *follow, error
      referrer: 'no-referrer', // *client, no-referrer
    }).then( this.setState(state: state) );
  }

  onStartSession = (e) => {
    fetch(`/api/journeys/${this.props.match.params.room}/start`, {
      cache: 'no-cache',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json'
      },
      method: 'POST',
      mode: 'cors',
    });
  }

  onLoadedMetadata = (e) => {
    this.setState({
      journeyDuration: e.target.duration
    });
    state.audioTag.removeEventListener('timeupdate', this.onTimeUpdate);
    state.audioTag.addEventListener('timeupdate', this.onTimeUpdate);
  }

    onTimeUpdate = (e) => {
    this.setState({
      playerProgress: (e.target.currentTime / e.target.duration) * 100,
      playerProgressMS: e.target.currentTime,
    });
    if (this.isHostUser) {
      fetch(`/api/journeys/${this.props.match.params.room}/progress`, {
        body: JSON.stringify({currentTime: e.target.currentTime}),
        cache: 'no-cache',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json'
        },
        method: 'PUT',
        mode: 'cors',
      });
    }
  }

  onFlag = (stream) => {
    fetch(`/api/journeys/${this.props.match.params.room}/flag`, {
      cache: 'no-cache',
      body: JSON.stringify({connectionId: this.state.session.connection.id, stream}),
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json'
      },
      method: 'POST',
      mode: 'cors',
    })
      .then(res => res.json())
      .then(json => state.journey = json);
  }

  onShare = (e) => {
    navigator.share({
      title: 'Take a Journey With Me!',
      text: `Join me on ${state.journey.name}`,
      url: `${window.location.protocol}//${window.location.host}/${state.journey.room}`,
    });
  }

  onInvite = (e) => {
    e.preventDefault();
    this.setState({
      showInviteModal: true
    });
  }

    onCloseShareModal = (e) => {
    e.preventDefault();
    this.setState({
      showInviteModal: false
    });
  }

    onCompleteShare = (url, name) => {
    this.setState({
      showInviteModal: false
    });
    window.location = url + `?journey=${state.journey.name}&name=${name}`;
  }

   onJoinMailingList = () => {
    window.location = "http://wacuri.com/stay-updated/";
  }

    // TODO: This is testing, it should be rmeoved...
    TEST_INVITATION = false;
    onOrientation = (e) => {
        e.preventDefault();
        if (this.TEST_INVITATION) {
            this.setState({
                showInviteModal: true
            });
        } else {
            this.setState({
                showOrientationModal: true
            });
        }

    e.stopPropagation();
  }

    onCloseOrientationModal = (e) => {
      e.preventDefault();
        if (this.TEST_INVITATION) {
            this.setState({
                showInviteModal: false
            });
        } else {
            this.setState({
                showOrientationModal: false
            });
        }
  }

  onCompleteOrienetation = (url, name) => {
    this.setState({
      showOrientationModal: false
    });
    window.location = url + `?journey=${state.journey.name}&name=${name}`;
  }


    onFeedback = (e) => {
	console.log("onFeedback called!");
    e.preventDefault();
    this.setState({
      showFeedbackModal: true
    });
    e.stopPropagation();
  }

  onCloseFeedbackModal = (e) => {
      e.preventDefault();
      console.log("onCloseFeedbackModal");
    this.setState({
      showFeedbackModal: false
    });
  }

  onCompleteFeedback = (url, name) => {
    this.setState({
      showFeedbackModal: false
    });
    window.location = url + `?journey=${state.journey.name}&name=${name}`;
  }



    seekTo = (fraction) => {
      console.log("duration",state.audioTag.duration);
      console.log("audioTag",state.audioTag.currentTime);
	state.audioTag.play();



    state.audioTag.currentTime = state.audioTag.duration * fraction;

      console.log("SEEK called with:",fraction);
	console.log("audioTag",state.audioTag.currentTime);
	// This only needs a target...must determine what time that is..
	// I think iit is the audioTag
	var e = {target: {currentTime: state.audioTag.currentTime}};
	this.onTimeUpdate(e);
  }

    togglePlayState = (e) => {
    e.preventDefault();
    setTimeout(() => {
      if (state.audioTag.paused) {
        fetch(`/api/journeys/${state.journey.room}/start`, {
          cache: 'no-cache',
          credentials: 'same-origin',
          headers: {
            'content-type': 'application/json'
          },
          method: 'POST',
          mode: 'cors',
        });
      } else {
        fetch(`/api/journeys/${state.journey.room}/pause`, {
          cache: 'no-cache',
          credentials: 'same-origin',
          headers: {
            'content-type': 'application/json'
          },
          method: 'POST',
          mode: 'cors',
        });
      }
    }, 20);
    }

    prepJourneyName = (name) => {
	const maxlen = 65;
	var value = name;
	if (value.length > maxlen) {
	    value = value.substring(0,62)+"...";
	}

	return value;
    }
    countPresentParticipants = (journey) => {
        const reducer = (accumulator, currentValue) => accumulator + (currentValue.present ? 1 : 0);
        if (journey)
            return journey.participants.reduce(reducer,0);
        else
            return 0;
    }
    render() {
        // Here I am attempting to set the background image---really thise needs to be done with the journy changes, not in render.

	    const currentParticipant = this.state.session && this.state.session.connection && state.journey && state.journey.participants.find(participant => participant.connectionId === this.state.session.connection.id);
	    var local_key_counter_to_avoid_warning = 0;
	    let currentUserHasFlaggedJourney = state.journey && state.journey.flags.map(flag => flag.user).indexOf(state.sessionId) > -1;
	var stream0 = this.state.streams[0];
	// NEXT
	// If the journey is not defined, then we are in a "permanentRoom". We can
	// enter a permament room form a straight URL or from within these pages.
	const spaceName = this.props.match.params.room;

	var optionkey = 0;
        // Here deal with the proper construction of the url.... may be dependent on the JourneySpace
        var urlprefix = (this.props.isPermanentSpace ? '.' : '..') + '/';
        var urlsuffix = '.bkg.jpg';

        // Note: I remove single quotes from the journey name here, I am not sure why this
        // is required, but it is.
        var url = (state.journey && state.journey.name) ? 'url(' + urlprefix + "journeyBackgrounds/" +  encodeURIComponent(state.journey.name.replace('\'','')) +urlsuffix + ')' : "none";
	return (
		<div className='journeyspace'
            id='journeyspace_id'
            style={{position: 'relative'}}
                >

		{this.state.session && /* AAA */
                 <div className='journeyspace-content' >


		{/* tob bar */}
		<div id="topbar_and_header">
		 <LTB.LogoAndTitleBar history={this.props.history} showLeave={true}
		 isPermanentSpace={this.props.isPermanentSpace}
                 skipOn={this.props.skipOn}
		 spaceName={spaceName}
                 extraOnLeave={MYonbeforeunload}
                 js_global_room={JS_GLOBAL_ROOM}
                 session_helper={JS_GLOBAL_SESSION_HELPER}
		 />

		 <div style={{ overflow: 'auto'}} >
		 <div id="titlebar" >
		 {/* Here I am testing the length of the journey title  */}
		 {state.journey.startAt && <span id={"journeyname"} style={{color: 'white'}} >
		  {this.prepJourneyName(state.journey.name)}</span>
		 }
                 {
                              (this.props.isPermanentSpace ||
		    (!state.journey.startAt && (state.journey.state === CREATED || state.journey.state === JOINED || state.journey.state === COMPLETED))) &&
		   <select onChange={this.onChangeJourney} value={'instruction'}>
                         <option value={'instruction'} selected={true}>{'Pulldown to select a new Journey'}</option>
                     {
		           state.journeys.map(journey => (
				   <option key={optionkey++} value={journey.filePath}>{journey.name}
			       <i className='far fa-smile'/>
			       </option>
                        ))}
                      </select>
		 }

                 <JourneyPhases playerState={this.state.playerState} timer={this.journeyStateTimer}  seekTo={this.seekTo}/>
		 </div>
		 <PhaseIndicator playerState={this.state.playerState} showingFeedback={this.state.showFeedbackModal}/>
		 </div>
	    </div>

		 <div className="flex-squares" id="flex-squares-id"
                             style={{position: 'relative',
                                     backgroundImage: url,
                                     backgroundSize: 'cover'}}>

		 {/* This is a modal which is usually invisible. */}
		 {this.state.showOrientationModal &&
		  <INTRO.OrientationModal force={true} onComplete={this.onCompleteOrientation} onClose={this.onCloseOrientationModal}/>
		 }

		 {this.state.showFeedbackModal &&
		  <INTRO.FeedbackModal
		  journeySpaceName={state.journey.name}
		  journey={this.state.session}
		  onComplete={this.onCompleteFeedback}
		  onClose={this.onCloseFeedbackModal}
		  onCloseAndInvite={(e) => { this.onCloseFeedbackModal(e);
					    this.onInvite(e);
		  }}
		  onJoinMailingList={(e) => { this.onCloseFeedbackModal(e);
					    this.onJoinMailingList(e);
		  }}
		  room={this.props.match.params.room}
		  history={this.props.history}
		  />
		 }



		 {/* here we create the two big squares;  */}

		 <div id="bigsquares">

                 <div  id="firstsquare" className="flexiblecol" key="name">
		 <div className="flexiblecol-content">
                 <img id='video-square0' className="journey-image" src={state.journey.image} onClick={this.togglePlayState}/>
                 {this.props.skipOn &&
		 <SkipButtonClear
		 visibility={{visibility: `${(!(this.state.showInviteModal || this.state.showOrientationModal || this.state.showFeedbackModal)) ? "visible" : "hidden"}`}}
		 publisher={this.publisher}
		 state={this.state}
		 setMicrophoneMutedState={(b) => {
		     this.publisher.state.publisher.publishAudio(!b);
		     this.setState({microphoneMuted: b});
		 }}
		 player={state.audioTag}
		 journey= {state.journey}
		 playerState={state.playerState}
		 seekTo={this.seekTo}>
		         </SkipButtonClear>
                 }
                 }
		         </div>
                 </div>



		 {/* This is the second square;  */}
		 <div id='secondsquare' className='flexiblecol'>





		 {/*
		  <div style={{display: 'flex', flexDirection: 'row', visibility: `${(this.state.showOrientationModal || this.state.showFeedbackModal ) ? "hidden" : "visible"}`}}>
		  */}



		 <div key="stream" id='video-square1' className='first-box flex-box journeyspace-stream journeyspace-me'>
		 <div className='box-content'>
                        <OTPublisher
                          session={this.sessionHelper.session}
                          onInit={this.onInitPublisher}
                 ref={publisher => {this.publisher = publisher}}
                 properties={{

                                width: '100%',
                     height: '100%',
  		     style: {buttonDisplayMode: 'off',
			    }
                              }}
                 />
		 </div>
		 <Controls
		 visibility={{visibility: `${(!(this.state.showInviteModal || this.state.showOrientationModal || this.state.showFeedbackModal)) ? "visible" : "hidden"}`}}
		 publisher={this.publisher}
		 state={this.state}
		 setMicrophoneMutedState={(b) => {
		     this.publisher.state.publisher.publishAudio(!b);
		     this.setState({microphoneMuted: b});
		 }}
		 player={state.audioTag}
		 journey= {state.journey}
		 playerState={state.playerState}
		 seekTo={this.seekTo}
		 />

		 </div>

		 <UnfilledVideoSquare vidid='video-square2'
		 additionalClass={'second-box'}
		 limit={1}
		 onInvite={this.onInvite}
		 streamlength={this.state.streams.length}
		 stream={this.state.streams[0]}
		 session={this.sessionHelper.session}
		 localkey={local_key_counter_to_avoid_warning++}
		 state={this.state}
		 journey={state.journey}
		 sessionId={state.sessionId}
		 visible={(!this.state.showOrientationModal)}
		 >

		 </UnfilledVideoSquare>


		 <UnfilledVideoSquare vidid='video-square3'
		 additionalClass={'third-box'}
		 limit={2}
		 onInvite={this.onInvite}
		 streamlength={this.state.streams.length}
		 stream={this.state.streams[1]}
		 session={this.sessionHelper.session}
		 localkey={local_key_counter_to_avoid_warning++}
		 state={this.state}
		 journey={state.journey}
		 sessionId={state.sessionId}
		 visible={(!this.state.showOrientationModal)}

		 ></UnfilledVideoSquare>

		 <NoVideoSquare vidid='video-square4'
		 additionalClass={'fourth-box'}
		 localkey={local_key_counter_to_avoid_warning++}
		 onOrientation={this.onOrientation}
		 onFeedback={this.onFeedback}
		 playerState={this.state.playerState}
		 ></NoVideoSquare>
		 </div>

		 {/*
		 </div>
		  */}
		 </div>

          {this.state.showInviteModal &&
            <InviteModal journey={this.state.session} onComplete={this.onCompleteShare} onClose={this.onCloseShareModal} history={this.props.history} />
          }


		 </div>
		 {/*
          <div className='journeyspace-footer' style={{display: 'flex'}}>
            <div style={{flex: 1}}>
            </div>
            <div style={{marginLeft: 'auto', marginRight: '10px', alignSelf: 'center'}}>
            </div>
          </div>
		  */}
			</div>
		}

			 {/* AAA */}


		    </div>
	)
	}
}
