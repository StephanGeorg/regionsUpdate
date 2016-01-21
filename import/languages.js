var _ = require('lodash'),
    jsonfile = require('jsonfile'),
    MongoClient = require('mongodb').MongoClient;

var file = __dirname + '/data/' + 'languages.json';
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
          console.log("!!! MongoDB: Update Error", err_update);
          callback(err_update);
        } else {
          console.log("MongoDB: 👾  Update in"  + (Date.now()-_time)/1000 + 's');
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
    var country = countries[h];
    return {
        nameEN: country.LanguageEN,
        name: country.Language,
        iso6391: country.Code1,
        iso6392: country.Code2,
        country: country.ISO
      };
  }

  return;

}

function getQuery(h) {

  console.log(getData(h));

  var country = getData(h).country;
  var lang = getData(h);

  delete lang.country;

  save({ where: {
      "geodata.geonames.country": country,
      "properties.admin_level": 2
    },
    data: {
       $push: { "geodata.languages": lang }
    },
  }, function(e,r){
    if(e) {
      console.log(e);
    }
    if(r) {
      if(getData((h+1))) {
        getQuery(++i);
      }
    }
  });
}

//getQuery(i);

save({
  where: {
    //"geodata.geonames.country": "FI"
    //rpath: "60199"
  },
  data: {
    $rename: {
      //"geodata.codes.koatuu": "",
      //"properties.tags.ref:at:gkz": "geodata.codes.uk:ons",
      "geodata.codes.uk:ons2" : "geodata.codes.uk:ons"
    }
  },
  options: {
    multi:true
  }
},function(e,r){
});
