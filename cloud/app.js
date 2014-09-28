var express = require('express');

var app = express();
app.use(express.bodyParser());

app.get('/:passId.pkpass', function(req, res) {
  Parse.Cloud.useMasterKey();

  var params = req.params;

  var passQuery = new Parse.Query('Pass');
  passQuery.get(params.passId).then(function(pass) {
    if (!pass) {
      console.log('Pass does not exist');
      res.send(404);
      return;
    }

    var file = pass.get('file');
    if (!file) {
      console.log('Pass has no file');
      res.send(404);
      return;
    }

    return Parse.Cloud.httpRequest({
      method: 'GET',
      url: file.url(),
    }).then(function(cloudRes) {
      res.set('Last-Modified', pass.updatedAt);
      res.type('application/vnd.apple.pkpass');
      res.send(200, cloudRes.buffer);
    });
  }).fail(function(error) {
    console.error(error);
    res.send(500);
  });
});

app.post('/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber', function(req, res) {
  Parse.Cloud.useMasterKey();

  var params = req.params;

  var passQuery = new Parse.Query('Pass');
  passQuery.equalTo('passTypeIdentifier', params.passTypeIdentifier);
  passQuery.equalTo('serialNumber', params.serialNumber);

  var pass;
  return passQuery.first().then(function(_pass) {
    pass = _pass;

    if (!pass) {
      console.log('Pass does not exist');
      res.send(404);
      return;
    }

    if (req.get('Authorization') !== 'ApplePass ' + pass.get('authenticationToken')) {
      console.log('Invalid authorization header');
      res.send(401);
      return;
    }

    var installationQuery = new Parse.Query(Parse.Installation);
    installationQuery.equalTo('deviceLibraryIdentifier', params.deviceLibraryIdentifier);
    installationQuery.equalTo('pass', pass);

    return installationQuery.first();
  }).then(function(installation) {
    if (installation) {
      console.log('Installation already exists');
      res.send(200);
      return;
    }

    var payload = req.body;
    if (!payload) {
      console.log('Invalid payload');
      res.send(400);
      return;
    }

    var pushToken = payload.pushToken;
    if (!pushToken) {
      console.log('Invalid payload');
      res.send(400);
      return;
    }

    var installation = new Parse.Installation;
    installation.set('deviceLibraryIdentifier', params.deviceLibraryIdentifier);
    installation.set('deviceToken', pushToken);
    installation.set('deviceType', 'ios');
    installation.set('pass', pass);

    return installation.save().then(function() {
      res.send(201);
    });
  }).fail(function(error) {
    console.error(error);
    res.send(500);
  });
});

app.get('/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier', function(req, res) {
  Parse.Cloud.useMasterKey();

  var params = req.params;

  var passQuery = new Parse.Query('Pass');
  passQuery.equalTo('passTypeIdentifier', params.passTypeIdentifier);

  if (params.passesUpdatedSince) {
    var date = new Date(params.passesUpdatedSince);
    passQuery.greaterThan('updatedAt', date);
  }

  var installationQuery = new Parse.Query(Parse.Installation);
  installationQuery.equalTo('deviceLibraryIdentifier', params.deviceLibraryIdentifier);
  installationQuery.matchesQuery('pass', passQuery);
  installationQuery.include('pass');

  var serialNumbers = [];
  var lastUpdated = null;

  return installationQuery.each(function(installation) {
    var pass = installation.get('pass');
    var serialNumber = pass.get('serialNumber');
    serialNumbers.push(serialNumber);

    if (!lastUpdated || pass.updatedAt > lastUpdated) {
      lastUpdated = pass.updatedAt;
    }
  }).then(function() {
    if (serialNumbers.length === 0) {
      console.log('No passes found');
      res.send(204);
      return;
    }

    res.send(200, {
      lastUpdated: lastUpdated ? lastUpdated.toISOString() : '',
      serialNumbers: serialNumbers,
    });
  }).fail(function(error) {
    console.error(error);
    res.send(500);
  });
});

app.get('/v1/passes/:passTypeIdentifier/:serialNumber', function(req, res) {
  Parse.Cloud.useMasterKey();

  var params = req.params;

  var passQuery = new Parse.Query('Pass');
  passQuery.equalTo('serialNumber', params.serialNumber);
  passQuery.equalTo('passTypeIdentifier', params.passTypeIdentifier);

  return passQuery.first().then(function(pass) {
    if (!pass) {
      console.log('Pass does not exist');
      res.send(404);
      return;
    }

    var file = pass.get('file');
    if (!file) {
      console.log('Pass has no file');
      res.send(404);
      return;
    }

    if (req.get('Authorization') !== 'ApplePass ' + pass.get('authenticationToken')) {
      console.log('Invalid authorization header');
      res.send(401);
      return;
    }

    var ifModifiedSince = req.get('If-Modified-Since');
    if (ifModifiedSince && pass.updatedAt < new Date(ifModifiedSince)) {
      console.log('Cached pass');
      res.send(304);
      return;
    }

    return Parse.Cloud.httpRequest({
      method: 'GET',
      url: file.url(),
    }).then(function(cloudRes) {
      res.set('Last-Modified', pass.updatedAt);
      res.type('application/vnd.apple.pkpass');
      res.send(200, cloudRes.buffer);
    });
  }).fail(function(error) {
    console.error(error);
    res.send(500);
  });
});

app.delete('/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber', function(req, res) {
  Parse.Cloud.useMasterKey();

  var params = req.params;

  var passQuery = new Parse.Query('Pass');
  passQuery.equalTo('serialNumber', params.serialNumber);
  passQuery.equalTo('passTypeIdentifier', params.passTypeIdentifier);

  return passQuery.first().then(function(pass) {
    if (!pass) {
      console.log('Pass does not exist');
      res.send(404);
      return;
    }

    if (req.get('Authorization') !== 'ApplePass ' + pass.get('authenticationToken')) {
      console.log('Invalid authorization header');
      res.send(401);
      return;
    }

    var installationQuery = new Parse.Query(Parse.Installation);
    installationQuery.equalTo('pass', pass);
    installationQuery.equalTo('deviceLibraryIdentifier', params.deviceLibraryIdentifier);

    return installationQuery.first().then(function(installation) {
      if (!installation) {
        console.log('Installation does not exist');
        res.send(404);
        return;
      }

      return installation.destroy().then(function() {
        res.send(200);
      });
    });
  }).fail(function(error) {
    console.error(error);
    res.send(500);
  });
});

app.post('/v1/log', function(req, res) {
  var payload = req.body;
  if (!payload) {
    console.log('Invalid payload');
    res.send(400);
    return;
  }

  var logs = payload.logs;
  if (!logs) {
    console.log('Invalid payload');
    res.send(400);
    return;
  }

  for (var i = 0; i < logs.length; i++) {
    console.log(logs[i]);
  }

  res.send(200);
});

// Start the app.
app.listen();
