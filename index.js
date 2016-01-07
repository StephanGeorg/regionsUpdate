// Packeges
var moment = require('moment'),
    _ = require('underscore');

// Models
var regions = require('./model/regions.js');

// Classes
var region = new regions();

// Get CLI arguments
var args = process.argv.slice(2);

var params = {
  query: {
    "properties.admin_level": 6, //"geodata.geonames": {$exists: false},
    "osm": {$exists: true},
    "geodata":{$exists: false}
  },
  fields: {
    limit: 2,
  },
};

function getMode(args) {
  if(args.length){
    return args[0];
  } else {
    return 'geonames';
  }
}


var check = function(params){
  region.get(params,function(err,res){
    if(err){
      console.log(err);
    } else {
      region.sync(getMode(args),res,function(err_sync,res_sync){
        console.log("Run ready!!!");
        check(params);
      });
    }
  });
};


check(params);
