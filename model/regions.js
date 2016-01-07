var MongoClient = require('mongodb').MongoClient,
    assert = require('assert'),
    _ = require('underscore'),
    colors = require('colors'),
    os = require("os");

// modules
var geonames = require('../modules/geonames.js'),
    osm = require('../modules/osm.js');

// load modules
var gn = new geonames({username: 'luftlinie.org'}),
    osm = new osm();

var url = "mongodb://nearest:1847895@candidate.53.mongolayer.com:10678,candidate.56.mongolayer.com:10412/nearestapp-devel?replicaSet=set-56279d5ae1d57f0eb700144d";

module.exports = function(params) {

  this.levels = [[],[],['PCLI','PCLD','PCLS','PCLF','PCL'],[],['ADM1','ADM2','ADMD','ADM1H'],[],['ADM2','ADM3','ADMD'],[],[],[],[]];
  this.run = {
    region: 0,
    maxRegion: 0,
    name: 0,
    maxName: 0,
    level: 0,
    maxLevel: 0,
    admin: 0,
    fuzzy: 0,
    notgeo: 0,
    reset: 0,
    run: 0,
  };

  this.params = {};

  this.getQueryOSM = function() {
    var region = this.params[this.run.region];

    return {
      id: region.id,
      fields: 'osm_id,bbox,center'
    };

  };

  this.getQueryGeonames = function(){

    var query = {},
        q = {},
        level,
        self = this;

    if(!self.changeQuery()) {
      return false;
    }

    var region = self.params[self.run.region];

    if(typeof region.properties.localname === 'string') {

      if(self.cleanLocalname(region.properties.localname)) {
        console.log("💋  Cleaned Name:",self.cleanLocalname(region.properties.localname));
        self.save(region.id,{"properties.localname": self.cleanLocalname(region.properties.localname)},false);
        region.properties.localname = self.cleanLocalname(region.properties.localname);
      } else {
        region.properties.localname = [region.properties.localname];
      }
    }

    self.run.maxName = region.properties.localname.length;
    self.run.maxLevel = self.levels[region.properties.admin_level].length;

    // add search mode
    if(self.run.fuzzy) {
      query.search = 'q';
    } else {
      query.search = 'name_equals';
    }
    q[query.search] = region.properties.localname[self.run.name];

    // add fcode filter
    q.fcode = self.levels[region.properties.admin_level][self.run.admin];

    // add geo filter
    if(!self.run.notgeo && region.osm && region.osm.bbox) {
      q.west = region.osm.bbox.coordinates[0][0][0];
      q.east = region.osm.bbox.coordinates[0][2][0];
      q.south = region.osm.bbox.coordinates[0][0][1];
      q.north = region.osm.bbox.coordinates[0][1][1];
    }

    console.log("Geonames: Searching " + q[query.search].red + " w/ "  + q.fcode.yellow + " Mode: " +  query.search.blue + " Geo: "  + self.run.notgeo);
    return q;

  };

  this.changeQuery = function(){

    if(this.run.run === 0) {
      this.run.run++;
      return this.run;
    }

    if(this.run.admin < (this.run.maxLevel-1)) {
      if(!this.run.reset){
        ++this.run.admin;
      } else {
        this.run.reset = 0;
      }
    } else {
      this.run.admin = 0;
      if(!this.run.fuzzy){
        ++this.run.fuzzy;
      } else {
        this.run.fuzzy = 0;
        this.run.admin = 0;
        if(!this.run.notgeo) {
          ++this.run.notgeo;
        } else {
          if(this.run.name < (this.run.maxName-1)) {
            console.log("change name");
            ++this.run.name;
            this.run.notgeo = 0;
            this.run.fuzzy = 0;
            this.run.admin = 0;
          } else {
            if(this.run.region < (this.run.maxRegion-1)) {
              this.resetRun();
            } else {
              return false;
            }
          }
        }
      }
    }
    return this.run;
  };

  this.resetRun = function(){
      console.log();
      this.run.region++;
      this.run.notgeo = 0;
      this.run.fuzzy = 0;
      this.run.name = 0;
      this.run.admin = 0;
  };

  this.parseResult = function(type, result, callback) {

    switch(type) {
      case 'geonames': gn.parseResult(result,true,function(err,res){
                          callback(err,res);
                       }); break;
      case 'osm':      return osm.parseResult(result);
      default: throw('Parser not defined!');
    }

    return false;

  };

  this.sync = function(type,params,callback) {

    this.params = params;
    this.run.maxRegion = this.params.length;

    switch(type) {
      case 'geonames': this.syncGeoname(callback); break;
      case 'osm':      this.syncOSM(callback); break;
      default: throw('Invalid Mode');
    }

  };

  this.syncGeoname = function(callback){

    var self = this,
        query = {},
        levels = this.levels[self.params.admin_level];

    var getSync = function(){
      var q = self.getQueryGeonames(),
          result = {};
      if(q) {
        // search geoname
        gn.get('search',q,function(err_gnget,res_gnget){
          if(err_gnget) {
            callback(err_gnget);
          }
          if(res_gnget.totalResultsCount) {
            console.log("Geonames: Search found ...".green);
            console.log("Geonames: Get geonameID ...".green);
            // parse result and get detailed data
            self.parseResult('geonames',res_gnget,function(err_detail,res_detail){
              if(res_detail) {
                console.log("Geonames: geonameID found ...".green);
                // save data to db
                self.save(self.params[self.run.region].id,{geodata:res_detail},1,function(err_save,res_save){
                  self.resetRun();
                  self.run.reset = 1;
                  if(res_save) {
                    if(self.run.region < (self.run.maxRegion-1)) {
                      getSync();
                      return;
                    }
                  } else {
                    getSync();
                    return;
                  }
                });
                return;
              } else {
                console.log("Geonames: geonameID not found ...".red);
                getSync();
                return;
              }
            });
            return;
          } else {
            console.log("Geonames: Search not found ...".red);
            getSync();
            return;
          }
        });
      }
    };

    getSync();

  };

  this.syncOSM = function(callback){

    var query = {},
        self = this;

    var getSync = function(){
      var q = self.getQueryOSM(),
          result = {};
      if(q) {
        osm.get('get',q,function(err_osm,res_osm){
          if(err_osm) {
            callback(err_osm);
          } else {
            result = self.parseResult('osm',res_osm);
            if(result) {
                console.log("OSM: ✅  osm_id: "  + result.osm_id.green);
                callback(null,result);
                if(self.run.region < (self.run.maxRegion-1)) {
                  self.resetRun();
                  getSync();
                }
            } else {
              console.log("OSM: not found ...");
              getSync();
            }
          }
        });
      }
    };

    getSync();

  };

  /*
   *  Save data to db
   */
  this.save = function(id,data,mod,callback){
    var _time = Date.now(),
        query = {};

    MongoClient.connect(url, function (err, db) {
      if (err) {
        console.log('Unable to connect to the mongoDB server. Error:', err);
      } else {
        regions = db.collection('regions');
        if(mod){
          query = { $currentDate: { "lastModified": true}};
        }
        if(data) {
          query.$set = data;
        }
        regions.updateOne({"id": id },query, function(err_update, res_update) {
          if(err_update) {
            console.log("!!! MongoDB: Update Error", err_update);
            callback(err_update);
          } else {
            console.log("MongoDB: 👾  Update " + id + ' in ' + (Date.now()-_time)/1000 + 's' + os.EOL);
            if(typeof callback === 'function') {
              callback(null,res_update);
            }
          }
          db.close();
        });
      }
      return;
    });
  };

  /*
   *  Get data from db
   */
  this.get = function(params,callback){
    var limit = params.limit;
    MongoClient.connect(url, function(err, db) {
      assert.equal(null, err);
      if(err){
        console.log(err);
      } else {
        console.log("Connected correctly to server.");
        regions = db.collection('regions');

        if(params.fields.limit === 1) {
          regions.findOne(params.query,function(err_findone,res_findone){
            if(err_findone) {
              callback(err_findone);
            } else {
              callback(null,[res_findone]);
            }
            db.close();
          });
        } else {
          regions.find(params.query,params.fields).toArray(function(err_find,res_find){
            if(err_find){
              callback(err_find);
            } else {
              callback(null,res_find);
            }
            db.close();
          });
        }
      }
    });
  };

  this.cleanLocalname = function(data) {
    var splits = [' / ',' - '];
    var re = /\(([^)]+)\)/;
    var result = '',
        name = data,
        x = 0,
        cleaned;
    if(typeof name === 'string') {
      _.each(splits,function(s){
        if(name.split(s).length > 1) {
          result = name.split(s);
        }
      });
      cleaned = name.match(re);
      if(cleaned) {
        _.each(data.tags,function(v,k){
          if(k.indexOf('name:') === 0){
            if(v === data.properties.localname) {
              x = 1;
            }
          }
        });
        if(!x) {
          result = [
            data.properties.localname.replace(cleaned[0],'').trim(),
            cleaned[1]
          ];
        }
      }
      if(result){
        return result;
      }
    }
    if(!name) {
      return data.properties.name;
    }

    return false;
  };


};
