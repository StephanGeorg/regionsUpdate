var _ = require('lodash'),
    jsonfile = require('jsonfile'),
    MongoClient = require('mongodb').MongoClient;

var file = __dirname + '/data/' + 'iso3166-2.json';
    countries = jsonfile.readFileSync(file);

var url = "mongodb://nearest:1847895@candidate.53.mongolayer.com:10678,candidate.56.mongolayer.com:10412/nearestapp-devel?replicaSet=set-56279d5ae1d57f0eb700144d";

var i = 0;


function save(params,callback){
  var _time = Date.now(),
      query = {};

  MongoClient.connect(url, function (err, db) {
    if (err) {
      console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
      regions = db.collection('regions');
      if(params.mod){
        query = { $currentDate: { "lastModified": true}};
      }
      if(params.data) {
        query = params.data;
      }

      regions.update(params.where,query,params.options,function(err_update, res_update) {
        if(err_update) {
          console.log("!!! MongoDB: Update Error ", err_update);
          callback(err_update);
        } else {
          //console.log("MongoDB: 👾  Update in "  + (Date.now()-_time)/1000 + 's');
          if(typeof callback === 'function') {
            callback(null,res_update);
          }
        }
        db.close();

      });
    }
    return;
  });
}


function getData(h) {

  if(h < countries.length) {
    return countries[h];
  }
  return;

}

function search(name,callback){
  MongoClient.connect(url, function (err, db) {
    if (err) {
      console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {

    }
  });
}

function getQuery(h) {

  var iso = getData(h);
  //var lang = getData(h);

  var level = 4;

  /*switch(nuts.level){
    case 1: level = 2; break;
    case 2: level = 2; break;
    case 3: level = 4; break;
  }*/

  save({ where: {
      $and: [{
          $or: [
            { "geodata.names.localnames.name": { $regex: new RegExp("^" + iso.name.toLowerCase(), "i") }},
            { "geodata.names.i18n.name": { $regex: new RegExp("^" + iso.name.toLowerCase(), "i") }},
            { "geodata.names.official.name": { $regex: new RegExp("^" + iso.name.toLowerCase(), "i") }},
            { "properties.name": { $regex: new RegExp("^" + iso.name.toLowerCase(), "i") }},
            { "geodata.codes.iso3166.code": iso.country + '-' + iso.code },
          ]
        },
        { $or: [
            { "properties.admin_level": 4 },
            { "properties.admin_level": 6 },
        ]}
      ],
      "geodata.geonames.country": iso.country,
    },
    data: {
      $set: {"geodata.codes.iso3166": {
         code: iso.country + '-' + iso.code,
         type: iso.type
       },
      },
      $addToSet: {
        "geodata.names.official": {
          name: iso.name,
          type: 'ISO3166'
        }
      },
    },
  }, function(e,r){
    if(e) {
      console.log(e);
    }
    if(r) {
      if(r.result.nModified) {
        console.log(" 🍏  ",iso.name,iso.country);
      } else {
        console.log(" 🍎  ",iso.name,iso.country);
      }
      if(getData((h+1))) {
        getQuery(++i);
      }
    }
  });
}

getQuery(i);

/*save({
  where: {
  },
  data: {
    $rename: {
      "geodata.names2": "geodata.names",
    }
  },
  options: {
    multi:true
  }
},function(e,r){
});*/
