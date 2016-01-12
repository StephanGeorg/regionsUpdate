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
      //id:4276613,
      //"rpath": "2528142",
      "rpath": {$nin: ["215477","215663","60189","60199","58974"/*,"214665"*/]},
      $and: [
        {$or: [{"lastModified": {$lt: moment().subtract(4,'hours').toDate() }},{"lastModified": {$exists: false},}],},
        {$or: [{"geodata.geonames.found":false}/*,{"geodata":{$exists:false}}*/],}
      ],
    },
    fields: {
      limit: 5,
    },
  },

  osm: {
    query: {
      "properties.admin_level": 8, //"geodata.geonames": {$exists: false},
      //"osm": {$exists: false},
      //"osm.area": { "$exists": false },
      "osm.bbox.type": { "$exists": false },
      $or: [{"lastModified": {$lt: moment().subtract(0.01,'hours').toDate() }},{"lastModified": {$exists: false},}],
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


var check = function(params){
  var _time = Date.now();
  region.get(query,function(err,res){
    if(err){
      console.log(err);
    }

    console.log(res.length);

    if(res.length) {
      region.sync(getMode(args),res,function(err_sync,res_sync){
        check(query);
        console.log("Step " + i++ + " ready in " + (Date.now()-_time)/1000 + 's' + os.EOL );
      });
    }
    return;
  });
};


check(query);
