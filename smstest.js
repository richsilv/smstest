Messages = new Meteor.Collection('messages');

Router.configure({
});

Router.map(function() {
    this.route('main', {
      path: '/',
      template: 'mainTemplate'
    });
});

if (Meteor.isClient) {
  Template.mainTemplate.helpers({
    messages: function() {
      return Messages.find();
    },
    incoming: function(message) {
      if (message.direction.slice(0, 7) === 'inbound') return true;
      return false;
    }
  })
}


if (Meteor.isServer) {
  Meteor.startup(function () {
    twilio = Twilio('AC716de04c0eb0210a3ef26fa268ca141d', '915251b0f30fa516bec60f021eadb197');
    natural = Npm.require('natural');
    tokenizer = new natural.WordTokenizer()
    Future = Npm.require('fibers/future');
    pollMessages();
    Meteor.setInterval(pollMessages, 5000);
  });

  Meteor.methods({
    'twilioStatus': function() {
      return twilio;
    },
    'sendSMS': function(number, message) {
      var fut = new Future();
      twilio.sendSms({
        to: number, // Any number Twilio can deliver to
        from: '+441952787013', // A number you bought from Twilio and can use for outbound communication
        body: message // body of the SMS message
      }, function(err, responseData) { //this function is executed when a response is received from Twilio
        if (!err) { // "err" is an error received during the request, if any
          // "responseData" is a JavaScript object containing data received from Twilio.
          // A sample response from sending an SMS message is here (click "JSON" to see how the data appears in JavaScript):
          // http://www.twilio.com/docs/api/rest/sending-sms#example-1
          fut['return']([responseData.from, responseData.body]); // outputs "word to your mother."
        }
      });
      return fut.wait();
    },
    'listSMS': function() {
      var fut = new Future();
      twilio.listSms({}, function(err, responseData) {
        fut['return'](responseData.smsMessages.map(function(message) {
            return {date: message.dateCreated, text: message.body, direction: message.direction, words: tokenizer.tokenize(message.body)};
        }));
      });
      return fut.wait();
    },
    'subresources': function() {
      var fut = new Future();
      twilio.accounts.list(function(err, responseData) {
        fut['return'](responseData.accounts[0].subresourceUris);
      });
      return fut.wait();
    }
  });
}

function pollMessages() {
    var sms = Meteor.call('listSMS');
    sms.forEach(function(message) {
      Messages.upsert(message, {$set: message});
  });
};
