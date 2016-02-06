
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

  this.params = {};

  this.initRun = function() {
    this.run = {
      region: 0,
      maxRegion: 0,
      name: 0,
      maxName: 0,
      level: 0,
      levels: 0,
      maxLevel: 0,
      admin: 0,
      fuzzy: 0,
      reset: 0,
      run: 0,
      localrun: 0,
      country: null,
      firstRunRegion: 0,
    };
  };

  this.getQueryOSM = function() {
    var region = this.params[this.run.region];

    return {
      id: region.id,
      fields: 'osm_id,bbox,center,way'
    };

  };

  this.getQueryGeonames = function(){

    var query = {},
        q = {},
        self = this,
        search = [];

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

    if(region.properties.localname === null) {
      region.properties.localname = [region.properties.name];
    }

    // Add searches

    search = self.getSearchNames(region.properties.localname);
    search = self.rmAdmin(search);
    search = _.uniq(search);
    self.run.maxName = search.length;

    // Add admin level
    self.getLocalAdminLevel();
    self.run.maxLevel = self.run.levels.length;

    // add search mode
    if(self.run.fuzzy) {
      query.search = 'q';
    } else {
      query.search = 'name_equals';
    }

    q[query.search] = search[self.run.name];

    // add geo filter
    /*if(!self.run.notgeo && region.osm && region.osm.bbox) {
      q.west = region.osm.bbox.coordinates[0][0][0];
      q.east = region.osm.bbox.coordinates[0][2][0];
      q.south = region.osm.bbox.coordinates[0][0][1];
      q.north = region.osm.bbox.coordinates[0][1][1];
    }*/

    console.log(q);

    // add country
    console.log("Geonames: Searching id: " + self.params[self.run.region].id.toString().underline + " " + q[query.search].red + " Mode: " +  query.search.blue);
    return q;

  };

  this.changeQuery = function(){

    // First run
    if(this.run.run === 0) {
      this.run.run++;
      return this.run;
    }

    if(!this.run.fuzzy){
      // Run reseted by method
      if(!this.run.reset){
        ++this.run.fuzzy;
      } else {
        this.run.reset = 0;
      }
    } else {
      this.run.fuzzy = 0;
      if(this.run.name < (this.run.maxName-1)) {
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

    return this.run;
  };

  this.checkNext = function(){

    var testRun = _.clone(this.run);

    delete testRun.country;

    // First run
    if(testRun.run === 0) {
      testRun.run++;
      return testRun;
    }

    if(!testRun.fuzzy){
      // Run reseted by method
      if(!testRun.reset){
        ++testRun.fuzzy;
      } else {
        testRun.reset = 0;
      }
    } else {
      testRun.fuzzy = 0;
      if(testRun.name < (testRun.maxName-1)) {
        ++testRun.name;
        testRun.notgeo = 0;
        testRun.fuzzy = 0;
        testRun.admin = 0;
      } else {
        if(testRun.region < (testRun.maxRegion-1)) {
          testRun.region++;
          testRun.fuzzy = 0;
          testRun.name = 0;
          testRun.localrun = 0;
        } else {
          return false;
        }
      }
    }

    return testRun;
  };

  this.resetRun = function(){
      this.run.region++;
      this.run.fuzzy = 0;
      this.run.name = 0;
      this.run.localrun = 0;
      //this.run.country = null;
  };

  this.parseResult = function(type, result, callback) {

    var region = this.params[this.run.region];

    switch(type) {
      case 'geonames': gn.parseResult(result,true,this.run,region,function(err,res){
                          callback(err,res);
                       }); break;
      case 'osm':      return osm.parseResult(result);
      default: throw('Parser not defined!');
    }

    return false;

  };

  this.getCountry = function(callback){

    var self = this,
        region;

    if(self.run.firstRunRegion === 1){
      region = self.params[self.run.region];
    } else {
      if(self.checkNext()){
        region = self.params[self.checkNext().region];
      } else {

      }
    }

    if(self.checkNext()) {
      if(self.params[self.run.region].properties.admin_level > 2 ) {
        var params = {
          query: {
            id: parseInt(region.rpath[region.rpath.length-2])
          },
          fields: {
            limit: 1
          }
        };
        self.get(params,function(e,r){
          if(r) {
            self.run.country = r[0];
            console.log("Country: id: " + self.run.country.id + " " + self.run.country.properties.name.yellow);
            callback();
          }
        });
      } else {
        callback();
      }
    } else {
      callback();
    }


  };

  this.sync = function(type,params,callback) {

    this.initRun();
    this.params = params;
    this.run.maxRegion = this.params.length;

    switch(type) {
      case 'update': this.ud(callback); break;
      case 'geonames': this.syncGeoname(callback); break;
      case 'osm':      this.syncOSM(callback); break;
      default: throw('Invalid Mode');
    }

  };

  this.checkFirstRunRegion = function() {

    var self = this;

    if(self.run.region === 0) {
      self.run.firstRunRegion++;
    }

    if(self.run.region) {
      self.run.firstRunRegion = 0;
    }


  };

  /*
   *  Geoname id exists, get Names
   */
  this.ud = function(callback){

  };

  this.syncGeoname = function(callback){

    var self = this,
        query = {};

    var region = self.params[self.run.region];

    var getSync = function(callback){

      self.checkFirstRunRegion();

      // get country
      self.getCountry(function(){

        var query = self.getQueryGeonames(),
            result = {};

        if(query) {
              // search geoname
              gn.get('search',query,function(err_gnget,res_gnget){
                if(err_gnget) {
                  callback(err_gnget);
                  return;
                }
                var res_search = gn.parseSearch(res_gnget,self.params[self.run.region],self.run);
                if(res_search) {

                  console.log("Geonames: Search found ...".green);
                  console.log("Geonames: Get geonameID ... ".green + res_search.geonameId);

                  // parse result and get detailed data
                  self.parseResult('geonames',res_search,function(err_detail,res_detail){
                    if(res_detail) {
                      console.log("Geonames: geonameID found ...".green);
                      // save data to db
                      var data = {};
                      _.each(res_detail,function(v,k){
                        if(k === 'names') {
                          _.each(v,function(vl,key){
                            data['geodata.names.' + key] = vl;
                          });
                        } else {
                          data["geodata." + k] = v;
                        }
                      });
                      self.save(self.params[self.run.region].id,data,1,function(err_save,res_save){});
                      self.resetRun();
                      self.run.reset = 1;
                        if(self.run.region < (self.run.maxRegion-1)) {
                          getSync(callback);
                        } else {
                          callback();
                        }
                    } else {
                      console.log("Geonames: geonameID not found ...".red);
                      getSync(callback);
                    }
                    return;
                  });
                } else {
                  console.log("Geonames: ⛔ ");
                  if(self.checkNext().region !== self.run.region) {
                    self.save(self.params[self.run.region].id,{ "geodata.geonames.found": false },1,function(){});
                    self.run.country = null;
                    getSync(callback);
                  } else {
                    var delay = Math.floor(((Math.random() * 2000) + 1));
                    console.log("Geonames: waiting for " + delay/1000 + "s ...");
                    setTimeout(function () {
                      getSync(callback);
                    }, delay);
                  }
                }
              });
              // EOS search geoname

        } else {
          console.log("Last!");
          //self.save(self.params[self.run.region].id,{geodata:{geonames:{found:false}}},1,function(){
            callback();
          //});
          return;
        }
      }); // EOS get country
    };

    getSync(callback);

  };

  this.syncOSM = function(callback){

    var query = {},
        self = this;

    var getSync = function(){
      var query = self.getQueryOSM(),
          result = {},
          region = self.params[self.run.region];
      if(query) {
        osm.get('get',query,function(err_osm,res_osm){
          if(err_osm) {
            callback(err_osm);
          } else {

            result = osm.parseResult(res_osm,region);

            if(result) {

              console.log("OSM: ✅  osm_id: ",result.id);
              // in callbak for save
              self.save(result.id,{osm:result},1,function(){});
              if(self.run.region < (self.run.maxRegion-1)) {
                self.resetRun();
                getSync(callback);
              } else {
                callback(null,result);
              }
              // in callback for save
            } else {
              console.log("OSM: not found ...");
              self.save(region.id,{osm:{found:false}},1,function(){
                if(self.run.region < (self.run.maxRegion-1)) {
                  self.resetRun();
                  getSync(callback);
                } else {
                  callback(true);
                }

              });

            }
          }
        });
      }
      return;
    };

    getSync(callback);

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
        callback(err);
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

    var limit = params.fields.limit,
        _time = Date.now();

    MongoClient.connect(url, function(err, db) {
      //assert.equal(null, err);
      if(err){
        console.log(err);
        callback(err,null);
        //db.close();
      } else {
        console.log("MongoDB: 📗  connection ready ...");
        regions = db.collection('regions');

        if(limit === 1) {
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
              //regions.find(params.query).count(function(e,count){
                //console.log("Left: " + count + " took " + (Date.now()-_time)/1000 + "s" + os.EOL);
                db.close();
              //});

              callback(null,res_find);

            }

          });
        }
      }
    });
  };

  this.getSearchNames = function(names){
    var region = this.params[this.run.region];

    _.each(region.properties.tags,function(name,key){
      if(key === 'int_name' || key.indexOf('name:') === 0 || key.indexOf('official_name') === 0 || key.indexOf('long_name') === 0) {
        if(key === 'int_name') {
          names.unshift(name.trim());
        } else {
          names.push(name.trim());
        }
      }
    });

    return _.uniq(names);
  };

  this.getLocalAdminLevel = function(){
    var region = this.params[this.run.region],
        rules = this.getHierarchy(),
        levels = [];

    _.each(rules[0],function(rule){
      if(rule.fcode) {
        levels.push(rule.fcode);
      }
    });
    if(levels.length) {
      levels = levels[0];
    }
    levels = gn.getAdminLevel(region,levels);
    region.levels = levels;
  };

  this.getHierarchy = function() {

    var region = this.params[this.run.region],
        hierarchies = {},
        rule= [];

    if(this.run.country && this.run.country.geodata && this.run.country.geodata.hierarchy) {
      hierarchies = this.run.country.geodata.hierarchy;
      _.each(hierarchies,function(hierarchy,key){
        if(key.indexOf('admin'+region.properties.admin_level) !== -1) {
          rule.push(hierarchy);
        }
      });
    }

    if(!rule.length) {
      rule.push([]);
    }

    // add standard rules
    rule[0].push({name:'Province'},{name:'Subdistrict'},{name:'District'},{name:'Region'},{name:'Local Municipality'},{name:'Municipality'},{name:'County'},{name:'Chiefdom'});
    return _.uniq(rule);

  };

  this.rmAdmin = function(names) {

    var region = this.params[this.run.region],
        rules = this.getHierarchy()[0];

    if(rules.length){
      _.each(rules,function(rule){
        if(rule.name) {
          _.each(names,function(name){

            if(name.indexOf(rule.name) !== -1) {
              names.push(name.replace(rule.name,"").trim());
            }
            // check also lower/uppercase
            if(name.toLowerCase().indexOf(rule.name.toLowerCase()) !== -1) {
              names.push(name.replace(rule.name.toLowerCase(),"").trim());
            }
            if(name.toUpperCase().indexOf(rule.name.toUpperCase()) !== -1) {
              names.push(name.replace(ucfirst(rule.name),"").trim());
            }
          });
        }
      });
    }

    return _.uniq(names);

  };

  this.cleanLocalname = function(data) {
    var splits = [' / ',' - '];
    var re = /\(([^)]+)\)/;
    var region = this.params[this.run.region];
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
        _.each(region.tags,function(v,k){
          if(k.indexOf('name:') === 0){

            if(v === region.properties.localname) {
              x = 1;
            }
          }
        });
        if(!x) {
          result = [
            region.properties.localname.replace(cleaned[0],'').trim(),
            cleaned[1]
          ];
        }
      }
      if(result){
        return result;
      }
    }
    if(!name) {
      return region.properties.name;
    }

    return false;
  };


};



// Helper

function shuffle(o){
  for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
  return o;
}

function ucfirst(str) {
  str += '';
  var f = str.charAt(0)
    .toUpperCase();
  return f + str.substr(1);
}
