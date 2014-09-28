Parse.Cloud.afterSave('Pass', function(req) {
  Parse.Cloud.useMasterKey();

  var pass = req.object;

  var installationQuery = new Parse.Query(Parse.Installation);
  installationQuery.equalTo('pass', pass);

  Parse.Push.send({
    data: {},
    where: installationQuery,
  });
});

Parse.Cloud.afterDelete('Pass', function(req) {
  Parse.Cloud.useMasterKey();

  var pass = req.object;

  var performDelete = function() {
    var installationQuery = new Parse.Query(Parse.Installation);
    installationQuery.equalTo('pass', pass);

    return installationQuery.find().then(function(installations) {
      if (installations.length > 0) {
        return Parse.Object.destroyAll(installations).then(performDelete);
      }
    });
  };
  performDelete();
});
