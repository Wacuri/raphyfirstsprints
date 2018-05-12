import React, { Component } from 'react';
import UserList from './user_list'
import GeneratorForm from './generator_form'
import EventMessage from './event_message'
import state from '../state'


var { OTSession, OTPublisher, OTStreams, OTSubscriber, createSession } = {};

if (__CLIENT__) {
  var { OTSession, OTPublisher, OTStreams, OTSubscriber, createSession } = require('opentok-react');
  const OT = require('@opentok/client');
  window.state = state;
}


export default class Home extends Component {
  constructor(props) {
    super(props);

    this.state = {
      streams: [],
      publisherId: '',
      session: null,
      totalConnectionsCreated: 0,
      connectedUsers: []
    }
    this.publisher = {};
  }


  componentDidMount() {
    const roomUrl = 'temp-home-location'

    fetch(`/api/sessions/${roomUrl}`)
      .then(res => res.json())
      .then(json => {
        state.session = json;
        this.sessionHelper = createSession({
          apiKey: state.openTokKey,
          sessionId: state.session.sessionId,
          token: state.session.token,
          onConnect: () => {
            console.log('assigned connection to publisher', this.sessionHelper.session.connection);
            setTimeout(this.refreshSession, 1000);
          },
          onStreamsUpdated: streams => {
            console.log('Current subscriber streams:', streams);
            this.setState({ streams });
          }
        });
        window.sh = this.sessionHelper;
        this.sessionHelper.session.on("connectionDestroyed", (event) => {
          console.log('DESTROYED', event);
          const data = {
            sessionId: this.sessionHelper.session.sessionId,
            connection: {
              id: event.connection.id
            },
            event: 'connectionDestroyed',

          }

          const updatedConnectionCount = this.state.totalConnectionsCreated - 1
          this.setState({totalConnectionsCreated: updatedConnectionCount})

          let newData = [...this.state.connectedUsers]
          let index = newData.indexOf(event.connection.id)
          newData.splice(index, 1)
          this.setState({connectedUsers: newData})

          console.log('data is', data);
          // fetch(`/api/event`, {
          //   body: JSON.stringify(data), // must match 'Content-Type' header
          //   cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
          //   credentials: 'same-origin', // include, same-origin, *omit
          //   headers: {
          //     'user-agent': 'Mozilla/4.0 MDN Example',
          //     'content-type': 'application/json'
          //   },
          //   method: 'POST', // *GET, POST, PUT, DELETE, etc.
          //   mode: 'cors', // no-cors, cors, *same-origin
          //   redirect: 'follow', // manual, *follow, error
          //   referrer: 'no-referrer', // *client, no-referrer
          // });
          // this.refreshSession();
        });



        this.sessionHelper.session.on("connectionCreated", (event) => {
          console.log('CREATED', event);
          const updatedConnectionCount = this.state.totalConnectionsCreated + 1
          this.setState({totalConnectionsCreated: updatedConnectionCount})
          console.log('**** Total connections: ' + this.state.totalConnectionsCreated)
          const data = {
            sessionId: this.sessionHelper.session.sessionId,
            connection: {
              id: event.connection.id
            },
            event: 'connectionCreated',
          }

          this.setState({ connectedUsers: [...this.state.connectedUsers, event.connection.id] })
          console.log('data is', data);
          // fetch(`/api/event`, {
          //   body: JSON.stringify(data), // must match 'Content-Type' header
          //   cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
          //   credentials: 'same-origin', // include, same-origin, *omit
          //   headers: {
          //     'user-agent': 'Mozilla/4.0 MDN Example',
          //     'content-type': 'application/json'
          //   },
          //   method: 'POST', // *GET, POST, PUT, DELETE, etc.
          //   mode: 'cors', // no-cors, cors, *same-origin
          //   redirect: 'follow', // manual, *follow, error
          //   referrer: 'no-referrer', // *client, no-referrer
          // });
          // this.refreshSession();
        });



        this.sessionHelper.session.on("signal", (event) => {
          console.log("Signal sent from connection ", event);
          console.log("Signal type", event.type);
          // this.refreshSession(); // FIXME Error: home.js:110 Uncaught TypeError: _this2.refreshSession is not a function

          if (event.type === 'signal:displayJourneyRequest') {
            console.log("**** CAPTURED the journey request !! ")
            this.setState({
              displayMessageVisible: true,
              displayMessageText: "George has created a session 'Daily Jetsons Meditation'.", //TEMP hard coded
              sessionUrl: '/another-jetsons-url'
            });
          }
        });

        this.setState({
          session: this.sessionHelper.session
        });
      });


    fetch('/api/journeys')
      .then(res => res.json())
      .then(json => {
        state.journeys = json;
      });

  }





  render() {
    return (
      <div className="home">
        <UserList userCount={this.state.totalConnectionsCreated} userIds={this.state.connectedUsers} />
        <EventMessage message={this.state.displayMessageText} sessionUrl={this.state.sessionUrl} />
        <GeneratorForm />
      </div>
      )
  }

}
