// Packeges
var moment = require('moment'),
    _ = require('underscore'),
    os = require('os');

// Models
var regions = require('./model/regions.js');

// Classes
var region = new regions();

// Get CLI arguments
var args = process.argv.slice(2);

var i = 1,
    delay = 1;

var params = {

  geonames: {
    query: {
      "properties.admin_level": 8,
      //"geodata.names": {$exists: false},
      "osm.center": {$exists: true},
      "geodata.names": { "$exists": false },
      //id: 147166,
      //"rpath": {$in: ["49715","72594","59065","3630439","1768185"]},
      //"rpath": {$nin: ["60189","60199","148838"]},
      $and: [
        {$or: [{"lastModified": {$lt: moment().subtract(3,'days').toDate() }},{"lastModified": {$exists: false},}],},
        //{$or: [/*{"geodata.geonames.found":false}/*,*/{"geodata":{$exists:false}}],}
      ],
    },
    fields: {
      limit: 5,
    },
  },

  osm: {
    query: {
      "properties.admin_level": 12, //"geodata.geonames": {$exists: false},
      //"osm": {$exists: false},
      //"osm.area": { "$exists": false },
      "osm.area": { "$exists": false },
      $or: [{"lastModified": {$lt: moment().subtract(1,'hours').toDate() }},{"lastModified": {$exists: false},}],
    },
    fields: {
      limit: 2,
    },
  }

};

var query = params[getMode(args)];


function getMode(args) {
  if(args.length){
    return args[0];
  } else {
    return 'geonames';
  }
}


var check = function(params){
  var _time = Date.now();
  region.get(query,function(err,res){

    if(err){
      console.log(err);
      console.log("Waiting to reconnect ... ");
      setTimeout(function(){
        check(query);
      },10000);
    } else {
      if(res && res.length) {
        console.log("Getting the next " + res.length + " documents");
        delay = 1;
        region.sync(getMode(args),res,function(err_sync,res_sync){
          check(query);
          console.log("Step " + i++ + " ready in " + (Date.now()-_time)/1000 + 's' + os.EOL );
        });
      } else {
        setTimeout(function(){
          delay *= 100;
          console.log("No more documents! Waiting for reconnect in " + delay/1000 + 's');
          check(query);
        },delay);
      }
    }
    return;
  });
};


check(query);
