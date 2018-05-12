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
            setTimeout(this.refreshSession, 1000);
          },
          onStreamsUpdated: streams => {
            this.setState({ streams });
          }
        });
        window.sh = this.sessionHelper;
        this.sessionHelper.session.on("connectionDestroyed", (event) => {
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
        });



        this.sessionHelper.session.on("connectionCreated", (event) => {
          const updatedConnectionCount = this.state.totalConnectionsCreated + 1
          this.setState({totalConnectionsCreated: updatedConnectionCount})

          const data = {
            sessionId: this.sessionHelper.session.sessionId,
            connection: {
              id: event.connection.id
            },
            event: 'connectionCreated',
          }

          this.setState({ connectedUsers: [...this.state.connectedUsers, event.connection.id] })
        });



        this.sessionHelper.session.on("signal", (event) => {
          if (event.type === 'signal:displayJourneyRequest') {
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
      <div className="home container">
        <div className="row">
          <UserList userCount={this.state.totalConnectionsCreated} userIds={this.state.connectedUsers} />
          <EventMessage journeys={state.journeys} />
          <GeneratorForm />
        </div>
      </div>
      )
  }

}
