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

var i = 1;

var params = {

  geonames: {
    query: {
      "properties.admin_level": 6, //"geodata.geonames": {$exists: false},
      "osm": {$exists: true},
      "geodata":{$exists: false},
      $or: [{"lastModified": {$lt: moment().subtract(1,'hours').toDate() }},{"lastModified": {$exists: false},}],
    },
    fields: {
      limit: 2,
    },
  },

  osm: {
    query: {
      "properties.admin_level": 8, //"geodata.geonames": {$exists: false},
      "osm": {$exists: false},
      $or: [{"lastModified": {$lt: moment().subtract(1,'hours').toDate() }},{"lastModified": {$exists: false},}],
    },
    fields: {
      limit: 10,
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

console.log(params[getMode(args)]);

var check = function(params){
  var _time = Date.now();
  region.get(query,function(err,res){
    if(err){
      console.log(err);
    } else {
      region.sync(getMode(args),res,function(err_sync,res_sync){
        check(query);
        console.log("Step " + i++ + " ready in " + (Date.now()-_time)/1000 + 's' + os.EOL );
      });
    }
    return;
  });
};


check(query);
